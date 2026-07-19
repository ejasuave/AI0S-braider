import { randomUUID } from 'node:crypto';
import type {
  CreatePortfolioItemRequest,
  CreateServiceOfferingRequest,
  DirectorySearchQuery,
  DirectorySearchResponse,
  DirectoryStylistDetail,
  PricingLookupRequest,
  PricingLookupResponse,
  PortfolioItem,
  ServiceOffering,
  StylistProfile,
  StyleCategory,
  UpdatePortfolioItemRequest,
  UpdateServiceOfferingRequest,
  UpdateStylistProfileRequest,
  Weekday,
} from '@project-braids/shared-types/api';
import { DEFAULT_WORKING_HOURS } from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getStorageProvider } from '../../lib/storage/index.js';
import {
  getBaseAvailabilityRules,
  baseRulesToLegacyWorkingHours,
  legacyWorkingHoursToRows,
} from '../stylist-profile/availability.js';
import { stylistProfileService } from '../stylist-profile/service.js';
import {
  ensureDefaultBusinessPolicy,
  getBusinessPolicyByStylistId,
  policyToLegacyDeposit,
} from '../stylist-profile/policy.js';
import {
  ensureStylistProfileForUser,
  findDuplicateOffering,
  getStylistProfileById,
  listActiveServiceOfferings,
  toPortfolioItem,
  toServiceOffering,
  toStylistProfile,
  toStyleCategory,
} from './mappers.js';
import { resolvePricingLookup } from './pricing-lookup.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ProfileService {
  async getOrCreateProfile(userId: string): Promise<StylistProfile> {
    const profile = await ensureStylistProfileForUser(userId);
    return toStylistProfile(profile);
  }

  async getProfileByStylistId(stylistId: string): Promise<StylistProfile> {
    const profile = await getStylistProfileById(stylistId);
    return toStylistProfile(profile);
  }

  async getPublicBookingPage(stylistId: string): Promise<{
    businessId: string | null;
    stylistId: string;
    businessName: string;
    locationArea: string | null;
    photoUrl: string | null;
    smsBookingNumber: string | null;
    portfolio: Array<{
      id: string;
      imageUrl: string;
      displayOrder: number;
      serviceOfferingId: string | null;
    }>;
    venueOptions: Array<'remote' | 'stylist_location' | 'come_to_client'>;
    homeVisitSurcharge: string | null;
    depositType: 'flat' | 'percentage';
    depositValue: number;
    remainingBalanceMethod: 'cash' | 'card' | 'cash_or_card';
    policy: {
      cancellationWindowHours: number;
      cancellationPolicyText: string | null;
      reschedulingPolicyText: string | null;
      lateArrivalPolicyText: string | null;
      noShowPolicyText: string | null;
      refundPolicyText: string | null;
      childrenPolicyText: string | null;
      guestPolicyText: string | null;
      depositPolicyText: string | null;
      remainingBalanceMethod: 'cash' | 'card' | 'cash_or_card';
      depositType: 'flat' | 'percentage';
      depositValue: number;
    } | null;
    offerings: Array<{
      id: string;
      styleName: string;
      description: string | null;
      basePrice: string;
      estimatedDurationMinutes: number;
      requirements: string[];
      depositType: 'flat' | 'percentage' | null;
      depositValue: number | null;
      addons: Array<{
        id: string;
        name: string;
        description: string | null;
        price: string;
      }>;
      portfolio: Array<{
        id: string;
        imageUrl: string;
        displayOrder: number;
        serviceOfferingId: string | null;
      }>;
    }>;
  }> {
    const profile = await getStylistProfileById(stylistId);
    const [business, offerings, otherWork, policy] = await Promise.all([
      profile.businessId
        ? prisma.business.findUnique({
            where: { id: profile.businessId },
            select: {
              offersStylistLocation: true,
              offersComeToClient: true,
              offersRemote: true,
              homeVisitSurcharge: true,
            },
          })
        : Promise.resolve(null),
      prisma.serviceOffering.findMany({
        where: { stylistId, active: true },
        include: {
          portfolioItems: {
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              imageUrl: true,
              displayOrder: true,
              serviceOfferingId: true,
            },
          },
          addons: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
            },
          },
        },
        orderBy: [{ styleName: 'asc' }, { sizeTier: 'asc' }, { lengthTier: 'asc' }],
      }),
      prisma.portfolioItem.findMany({
        where: { stylistId, serviceOfferingId: null },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          imageUrl: true,
          displayOrder: true,
          serviceOfferingId: true,
        },
      }),
      profile.businessId
        ? prisma.businessPolicy.findUnique({ where: { businessId: profile.businessId } })
        : Promise.resolve(null),
    ]);

    const portfolio = [
      ...offerings.flatMap((offering) =>
        offering.portfolioItems.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          displayOrder: item.displayOrder,
          serviceOfferingId: item.serviceOfferingId,
        })),
      ),
      ...otherWork,
    ];

    const venueOptions: Array<'remote' | 'stylist_location' | 'come_to_client'> = [];
    if (business?.offersStylistLocation) venueOptions.push('stylist_location');
    if (business?.offersComeToClient) venueOptions.push('come_to_client');
    if (business?.offersRemote) venueOptions.push('remote');
    if (venueOptions.length === 0) venueOptions.push('stylist_location');

    const depositType = policy?.depositType ?? 'percentage';
    const depositValue = policy?.depositValue?.toNumber() ?? 20;
    const remainingBalanceMethod = policy?.remainingBalanceMethod ?? 'cash_or_card';

    return {
      businessId: profile.businessId,
      stylistId: profile.id,
      businessName: profile.businessName,
      locationArea: profile.locationArea,
      photoUrl: profile.photoUrl,
      smsBookingNumber: profile.smsBookingNumber,
      portfolio,
      venueOptions,
      homeVisitSurcharge: business?.homeVisitSurcharge
        ? business.homeVisitSurcharge.toFixed(2)
        : null,
      depositType,
      depositValue,
      remainingBalanceMethod,
      policy: policy
        ? {
            cancellationWindowHours: policy.cancellationWindowHours,
            cancellationPolicyText: policy.cancellationPolicyText,
            reschedulingPolicyText: policy.reschedulingPolicyText,
            lateArrivalPolicyText: policy.lateArrivalPolicyText,
            noShowPolicyText: policy.noShowPolicyText,
            refundPolicyText: policy.refundPolicyText,
            childrenPolicyText: policy.childrenPolicyText,
            guestPolicyText: policy.guestPolicyText,
            depositPolicyText: policy.depositPolicyText,
            remainingBalanceMethod: policy.remainingBalanceMethod,
            depositType: policy.depositType,
            depositValue: policy.depositValue.toNumber(),
          }
        : null,
      offerings: offerings.map((offering) => {
        const requirements = Array.isArray(offering.requirements)
          ? offering.requirements.filter((item): item is string => typeof item === 'string')
          : [];
        return {
          id: offering.id,
          styleName: offering.styleName,
          description: offering.description,
          basePrice: offering.basePrice.toFixed(2),
          estimatedDurationMinutes: offering.estimatedDurationMinutes,
          requirements,
          depositType: offering.depositType,
          depositValue: offering.depositValue != null ? offering.depositValue.toNumber() : null,
          addons: offering.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            description: addon.description,
            price: addon.price.toFixed(2),
          })),
          portfolio: offering.portfolioItems.map((item) => ({
            id: item.id,
            imageUrl: item.imageUrl,
            displayOrder: item.displayOrder,
            serviceOfferingId: item.serviceOfferingId,
          })),
        };
      }),
    };
  }

  async updateProfile(
    stylistId: string,
    input: UpdateStylistProfileRequest,
  ): Promise<StylistProfile> {
    const existing = await getStylistProfileById(stylistId);

    if (input.directoryVisible === true) {
      await this.assertDirectoryReady(stylistId, {
        businessName: input.businessName ?? existing.businessName,
        locationArea: input.locationArea !== undefined ? input.locationArea : existing.locationArea,
      });
    }

    if (input.workingHours !== undefined && existing.businessId) {
      const rows = legacyWorkingHoursToRows(input.workingHours);
      if (rows.length === 0) {
        throw ApiError.validation('At least one enabled working day is required');
      }
      await stylistProfileService.replaceWorkingHours(existing.businessId, rows);
    }

    const profile = await prisma.stylistProfile.update({
      where: { id: stylistId },
      data: {
        ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.locationArea !== undefined ? { locationArea: input.locationArea } : {}),
        ...(input.serviceAreaRadiusKm !== undefined
          ? { serviceAreaRadiusKm: input.serviceAreaRadiusKm }
          : {}),
        ...(input.cancellationPolicy !== undefined
          ? { cancellationPolicy: input.cancellationPolicy }
          : {}),
        ...(input.depositPolicy !== undefined ? { depositPolicy: input.depositPolicy } : {}),
        ...(input.workingHours !== undefined && !existing.businessId
          ? { workingHours: input.workingHours }
          : {}),
        ...(input.bufferMinutes !== undefined ? { bufferMinutes: input.bufferMinutes } : {}),
        ...(input.onboardingStatus !== undefined
          ? { onboardingStatus: input.onboardingStatus }
          : {}),
        ...(input.directoryVisible !== undefined
          ? { directoryVisible: input.directoryVisible }
          : {}),
      },
    });

    if (profile.directoryVisible) {
      await this.assertDirectoryReady(stylistId, {
        businessName: profile.businessName,
        locationArea: profile.locationArea,
      });
    }

    return toStylistProfile(profile);
  }

  private async assertDirectoryReady(
    stylistId: string,
    profile: { businessName: string; locationArea: string | null },
  ): Promise<void> {
    if (!profile.businessName.trim()) {
      throw ApiError.validation('Business name is required before listing in the directory');
    }
    if (!profile.locationArea?.trim()) {
      throw ApiError.validation('Location area is required before listing in the directory');
    }

    const activeServices = await listActiveServiceOfferings(stylistId);
    if (activeServices.length === 0) {
      throw ApiError.validation('Add at least one active service before listing in the directory');
    }
  }

  async searchDirectory(query: DirectorySearchQuery): Promise<DirectorySearchResponse> {
    const where = {
      directoryVisible: true,
      businessName: { not: '' },
      locationArea: { not: null },
      serviceOfferings: { some: { active: true } },
      ...(query.location
        ? { locationArea: { contains: query.location, mode: 'insensitive' as const } }
        : {}),
      ...(query.style
        ? {
            serviceOfferings: {
              some: {
                active: true,
                styleName: { contains: query.style, mode: 'insensitive' as const },
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { businessName: { contains: query.q, mode: 'insensitive' as const } },
              { locationArea: { contains: query.q, mode: 'insensitive' as const } },
              { bio: { contains: query.q, mode: 'insensitive' as const } },
              {
                serviceOfferings: {
                  some: {
                    active: true,
                    styleName: { contains: query.q, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stylistProfile.findMany({
        where,
        include: {
          serviceOfferings: {
            where: { active: true },
            orderBy: { basePrice: 'asc' },
          },
          portfolioItems: {
            orderBy: { displayOrder: 'asc' },
            take: 1,
            select: { imageUrl: true },
          },
        },
        orderBy: { businessName: 'asc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.stylistProfile.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        stylistId: row.id,
        businessName: row.businessName,
        locationArea: row.locationArea ?? '',
        bio: row.bio,
        photoUrl: row.photoUrl,
        coverImageUrl: row.photoUrl ?? row.portfolioItems[0]?.imageUrl ?? null,
        styleNames: [...new Set(row.serviceOfferings.map((offering) => offering.styleName))],
        startingPrice: row.serviceOfferings[0]?.basePrice.toFixed(2) ?? null,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getDirectoryStylist(stylistId: string): Promise<DirectoryStylistDetail> {
    const profile = await prisma.stylistProfile.findFirst({
      where: {
        id: stylistId,
        directoryVisible: true,
        businessName: { not: '' },
        locationArea: { not: null },
      },
    });

    if (!profile) {
      throw ApiError.notFound('Stylist not found in directory');
    }

    const offerings = await prisma.serviceOffering.findMany({
      where: { stylistId, active: true },
      include: {
        portfolioItems: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            imageUrl: true,
            displayOrder: true,
            serviceOfferingId: true,
          },
        },
        addons: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
          },
        },
      },
      orderBy: [{ styleName: 'asc' }, { sizeTier: 'asc' }, { lengthTier: 'asc' }],
    });

    if (offerings.length === 0) {
      throw ApiError.notFound('Stylist not found in directory');
    }

    const otherWork = await prisma.portfolioItem.findMany({
      where: { stylistId, serviceOfferingId: null },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        imageUrl: true,
        displayOrder: true,
        serviceOfferingId: true,
      },
    });

    const portfolio = [
      ...offerings.flatMap((offering) =>
        offering.portfolioItems.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          displayOrder: item.displayOrder,
          serviceOfferingId: item.serviceOfferingId,
        })),
      ),
      ...otherWork,
    ];

    return {
      stylistId: profile.id,
      businessName: profile.businessName,
      locationArea: profile.locationArea ?? '',
      bio: profile.bio,
      photoUrl: profile.photoUrl,
      smsBookingNumber: profile.smsBookingNumber,
      portfolio,
      offerings: offerings.map((offering) => {
        const requirements = Array.isArray(offering.requirements)
          ? offering.requirements.filter((item): item is string => typeof item === 'string')
          : [];
        return {
          id: offering.id,
          styleName: offering.styleName,
          description: offering.description,
          basePrice: offering.basePrice.toFixed(2),
          estimatedDurationMinutes: offering.estimatedDurationMinutes,
          requirements,
          depositType: offering.depositType,
          depositValue: offering.depositValue != null ? offering.depositValue.toNumber() : null,
          addons: offering.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            description: addon.description,
            price: addon.price.toFixed(2),
          })),
          portfolio: offering.portfolioItems.map((item) => ({
            id: item.id,
            imageUrl: item.imageUrl,
            displayOrder: item.displayOrder,
            serviceOfferingId: item.serviceOfferingId,
          })),
        };
      }),
    };
  }

  async listStyleCategories(): Promise<StyleCategory[]> {
    const categories = await prisma.styleCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map(toStyleCategory);
  }

  async listServiceOfferings(stylistId: string): Promise<ServiceOffering[]> {
    const offerings = await listActiveServiceOfferings(stylistId);
    return offerings.map((offering) => toServiceOffering(offering));
  }

  async createServiceOffering(
    stylistId: string,
    input: CreateServiceOfferingRequest,
  ): Promise<ServiceOffering> {
    const profile = await getStylistProfileById(stylistId);
    if (!profile.businessId) {
      throw ApiError.validation('Business must be linked before creating services');
    }

    const sizeTier = input.sizeTier ?? null;
    const lengthTier = input.lengthTier ?? null;

    const duplicate = await findDuplicateOffering(stylistId, input.styleName, sizeTier, lengthTier);
    if (duplicate) {
      throw new ApiError(
        'CONFLICT',
        'A service offering with this style and tier combination already exists',
        409,
      );
    }

    const offering = await prisma.serviceOffering.create({
      data: {
        businessId: profile.businessId,
        stylistId,
        styleName: input.styleName.trim(),
        sizeTier,
        lengthTier,
        basePrice: input.basePrice,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        hairIncluded: input.hairIncluded ?? false,
        isCustomStyle: input.isCustomStyle ?? false,
      },
    });

    return toServiceOffering(offering);
  }

  async updateServiceOffering(
    stylistId: string,
    offeringId: string,
    input: UpdateServiceOfferingRequest,
  ): Promise<ServiceOffering> {
    const existing = await prisma.serviceOffering.findFirst({
      where: { id: offeringId, stylistId },
    });
    if (!existing) {
      throw ApiError.notFound('Service offering not found');
    }

    const nextStyleName = input.styleName?.trim() ?? existing.styleName;
    const nextSizeTier = input.sizeTier !== undefined ? input.sizeTier : existing.sizeTier;
    const nextLengthTier = input.lengthTier !== undefined ? input.lengthTier : existing.lengthTier;

    if (
      input.styleName !== undefined ||
      input.sizeTier !== undefined ||
      input.lengthTier !== undefined
    ) {
      const duplicate = await findDuplicateOffering(
        stylistId,
        nextStyleName,
        nextSizeTier,
        nextLengthTier,
        offeringId,
      );
      if (duplicate) {
        throw new ApiError(
          'CONFLICT',
          'A service offering with this style and tier combination already exists',
          409,
        );
      }
    }

    const offering = await prisma.serviceOffering.update({
      where: { id: offeringId },
      data: {
        ...(input.styleName !== undefined ? { styleName: input.styleName.trim() } : {}),
        ...(input.sizeTier !== undefined ? { sizeTier: input.sizeTier } : {}),
        ...(input.lengthTier !== undefined ? { lengthTier: input.lengthTier } : {}),
        ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
        ...(input.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: input.estimatedDurationMinutes }
          : {}),
        ...(input.hairIncluded !== undefined ? { hairIncluded: input.hairIncluded } : {}),
        ...(input.isCustomStyle !== undefined ? { isCustomStyle: input.isCustomStyle } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    return toServiceOffering(offering);
  }

  async deactivateServiceOffering(stylistId: string, offeringId: string): Promise<ServiceOffering> {
    return this.updateServiceOffering(stylistId, offeringId, { active: false });
  }

  async lookupPricing(
    stylistId: string,
    input: PricingLookupRequest,
  ): Promise<PricingLookupResponse> {
    const offerings = await listActiveServiceOfferings(stylistId);
    return resolvePricingLookup(offerings, input);
  }

  async listPortfolioItems(stylistId: string): Promise<PortfolioItem[]> {
    const items = await prisma.portfolioItem.findMany({
      where: { stylistId },
      orderBy: { displayOrder: 'asc' },
    });
    return items.map(toPortfolioItem);
  }

  async createPortfolioItemFromUrl(
    stylistId: string,
    input: CreatePortfolioItemRequest,
  ): Promise<PortfolioItem> {
    if (!input.imageUrl) {
      throw ApiError.validation('imageUrl is required when not uploading a file');
    }

    const profile = await getStylistProfileById(stylistId);
    if (!profile.businessId) {
      throw ApiError.validation('Business must be linked before adding portfolio items');
    }

    if (input.serviceOfferingId) {
      const offering = await prisma.serviceOffering.findFirst({
        where: { id: input.serviceOfferingId, stylistId },
        select: { id: true },
      });
      if (!offering) {
        throw ApiError.notFound('Service offering not found');
      }
    }

    const maxOrder = await prisma.portfolioItem.aggregate({
      where: {
        stylistId,
        ...(input.serviceOfferingId ? { serviceOfferingId: input.serviceOfferingId } : {}),
      },
      _max: { displayOrder: true },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        businessId: profile.businessId,
        stylistId,
        serviceOfferingId: input.serviceOfferingId ?? null,
        imageUrl: input.imageUrl,
        source: 'manual',
        displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    return toPortfolioItem(item);
  }

  async uploadPortfolioImage(
    stylistId: string,
    file: { buffer: Buffer; contentType: string; filename: string },
    displayOrder?: number,
  ): Promise<PortfolioItem> {
    if (!ALLOWED_IMAGE_TYPES.has(file.contentType)) {
      throw ApiError.validation('Unsupported image type. Use JPEG, PNG, or WebP.');
    }
    if (file.buffer.byteLength > MAX_IMAGE_BYTES) {
      throw ApiError.validation('Image exceeds 5 MB limit');
    }

    const profile = await getStylistProfileById(stylistId);
    if (!profile.businessId) {
      throw ApiError.validation('Business must be linked before uploading portfolio images');
    }

    const extension =
      file.contentType === 'image/png' ? 'png' : file.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `portfolio/${stylistId}/${randomUUID()}.${extension}`;
    const storage = getStorageProvider();
    const uploaded = await storage.upload({
      key,
      body: file.buffer,
      contentType: file.contentType,
    });

    const maxOrder = await prisma.portfolioItem.aggregate({
      where: { stylistId },
      _max: { displayOrder: true },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        businessId: profile.businessId,
        stylistId,
        imageUrl: uploaded.publicUrl,
        storageKey: uploaded.key,
        source: 'manual',
        displayOrder: displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    return toPortfolioItem(item);
  }

  async updatePortfolioItem(
    stylistId: string,
    itemId: string,
    input: UpdatePortfolioItemRequest,
  ): Promise<PortfolioItem> {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id: itemId, stylistId },
    });
    if (!existing) {
      throw ApiError.notFound('Portfolio item not found');
    }

    const item = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      },
    });

    return toPortfolioItem(item);
  }

  async deletePortfolioItem(stylistId: string, itemId: string): Promise<void> {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id: itemId, stylistId },
    });
    if (!existing) {
      throw ApiError.notFound('Portfolio item not found');
    }

    if (existing.storageKey) {
      await getStorageProvider().delete(existing.storageKey);
    }

    await prisma.portfolioItem.delete({ where: { id: itemId } });
  }

  async getActiveServiceOffering(stylistId: string, offeringId: string) {
    const offering = await prisma.serviceOffering.findFirst({
      where: { id: offeringId, stylistId, active: true },
    });
    if (!offering) {
      throw ApiError.notFound('Service offering not found');
    }
    return offering;
  }

  async getSchedulingSettings(stylistId: string): Promise<{
    bufferMinutes: number;
    depositPolicy: { type: 'flat' | 'percent'; value: number } | null;
  }> {
    const profile = await getStylistProfileById(stylistId);
    if (profile.businessId) {
      await ensureDefaultBusinessPolicy(profile.businessId);
      const policy = await getBusinessPolicyByStylistId(stylistId);
      return {
        bufferMinutes: profile.bufferMinutes,
        depositPolicy: policyToLegacyDeposit(policy),
      };
    }

    return {
      bufferMinutes: profile.bufferMinutes,
      depositPolicy: profile.depositPolicy as { type: 'flat' | 'percent'; value: number } | null,
    };
  }

  async getAvailabilityContext(stylistId: string): Promise<{
    bufferMinutes: number;
    workingHours: Record<Weekday, { enabled: boolean; start: string; end: string }>;
  }> {
    const profile = await getStylistProfileById(stylistId);
    const legacyWorkingHours =
      (profile.workingHours as Record<Weekday, { enabled: boolean; start: string; end: string }>) ??
      DEFAULT_WORKING_HOURS;

    if (profile.businessId) {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const rules = await getBaseAvailabilityRules(profile.businessId, from, to);
      const fromRules = baseRulesToLegacyWorkingHours(rules) as Record<
        Weekday,
        { enabled: boolean; start: string; end: string }
      >;
      const hasConfiguredHours = Object.values(fromRules).some((day) => day.enabled);

      return {
        bufferMinutes: profile.bufferMinutes,
        workingHours: hasConfiguredHours ? fromRules : legacyWorkingHours,
      };
    }

    return {
      bufferMinutes: profile.bufferMinutes,
      workingHours: legacyWorkingHours,
    };
  }
}

export const profileService = new ProfileService();
