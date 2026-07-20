import { randomUUID } from 'node:crypto';
import type {
  BusinessPolicy,
  BusinessProfile,
  CreateBusinessServiceRequest,
  CreateServiceAddonRequest,
  PortfolioItem,
  RegisterPortfolioItemRequest,
  RegisterProfilePhotoRequest,
  ReorderPortfolioRequest,
  ReorderServiceAddonsRequest,
  ServiceAddon,
  ServiceOffering,
  StyleCategory,
  UpdateBusinessPolicyRequest,
  UpdateBusinessProfileRequest,
  UpdateBusinessServiceRequest,
  UpdateServiceAddonRequest,
  WorkingHourRow,
} from '@project-braids/shared-types/api';
import { MAX_SERVICE_ADDONS, slugify } from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import {
  createPortfolioStorageKey,
  createProfilePhotoStorageKey,
  getStorageProvider,
} from '../../lib/storage/index.js';
import { businessService } from '../roles/business.service.js';
import { ensureStylistProfileForUser } from '../profile/mappers.js';
import { serializeRequirements } from './requirements.js';
import {
  baseRulesToLegacyWorkingHours,
  ensureDefaultWorkingHoursForBusiness,
  getBaseAvailabilityRules,
  validateWorkingHourRows,
} from './availability.js';
import { ensureDefaultBusinessPolicy, getBusinessPolicy, policyToLegacyDeposit } from './policy.js';
import { instagramService } from './instagram.service.js';
import {
  PORTFOLIO_IMAGES_PER_SERVICE,
  PORTFOLIO_ITEM_LIMIT,
  toBusinessPolicy,
  toBusinessProfile,
  toPortfolioItem,
  toServiceAddon,
  toServiceOffering,
  toStyleCategory,
} from './mappers.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class StylistProfileService {
  /** Generate a unique publicSlug when missing (used for vanity booking links). */
  private async ensurePublicSlugForProfile(
    stylistId: string,
    preferredName?: string,
  ): Promise<string> {
    const profile = await prisma.stylistProfile.findUnique({ where: { id: stylistId } });
    if (!profile) throw ApiError.notFound('Stylist profile not found');
    if (profile.publicSlug) return profile.publicSlug;

    const base =
      slugify(preferredName || profile.businessName || `stylist-${stylistId.slice(0, 8)}`) ||
      `stylist-${stylistId.slice(0, 8)}`;
    let candidate = base;
    let suffix = 0;
    while (true) {
      const existing = await prisma.stylistProfile.findUnique({
        where: { publicSlug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === stylistId) break;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    await prisma.stylistProfile.update({
      where: { id: stylistId },
      data: { publicSlug: candidate },
    });
    return candidate;
  }

  async createBusinessForOwner(userId: string, businessName = ''): Promise<BusinessProfile> {
    await ensureStylistProfileForUser(userId);
    const business = await businessService.ensureBusinessForOwner(userId, businessName);
    await ensureDefaultBusinessPolicy(business.id);
    await this.ensureDefaultWorkingHours(business.id);
    return this.getBusinessProfile(business.id);
  }

  async resolveBusinessContext(
    userId: string,
    role: string,
  ): Promise<{
    businessId: string;
    stylistId: string;
  }> {
    const businessId = await businessService.resolveBusinessIdForUser(userId, role);
    if (!businessId) {
      throw new ApiError('FORBIDDEN', 'Business context required', 403);
    }

    const profile = await prisma.stylistProfile.findFirst({
      where: { businessId },
      select: { id: true },
    });
    if (!profile) {
      throw ApiError.notFound('Stylist profile not found for business');
    }

    return { businessId, stylistId: profile.id };
  }

  async getBusinessProfile(businessId: string): Promise<BusinessProfile> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { profile: { select: { id: true } } },
    });
    if (!business) {
      throw ApiError.notFound('Business not found');
    }
    return toBusinessProfile(business);
  }

  async updateBusinessProfile(
    businessId: string,
    input: UpdateBusinessProfileRequest,
  ): Promise<BusinessProfile> {
    const existing = await prisma.business.findUnique({ where: { id: businessId } });
    if (!existing) {
      throw ApiError.notFound('Business not found');
    }

    const offersStylistLocation = input.offersStylistLocation ?? existing.offersStylistLocation;
    const offersComeToClient = input.offersComeToClient ?? existing.offersComeToClient;
    const offersRemote = input.offersRemote ?? existing.offersRemote;

    const venueFieldsTouched =
      input.offersStylistLocation !== undefined ||
      input.offersComeToClient !== undefined ||
      input.offersRemote !== undefined ||
      input.workplaceAddress !== undefined;

    if (venueFieldsTouched && !offersStylistLocation && !offersComeToClient && !offersRemote) {
      throw ApiError.validation('Select at least one venue option');
    }

    const nextWorkplace =
      input.workplaceAddress !== undefined ? input.workplaceAddress : existing.workplaceAddress;

    if (
      venueFieldsTouched &&
      offersStylistLocation &&
      (!nextWorkplace || nextWorkplace.trim().length < 5)
    ) {
      throw ApiError.validation(
        'Add your workplace address when clients can come to your location',
      );
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.locationLat !== undefined ? { locationLat: input.locationLat } : {}),
        ...(input.locationLng !== undefined ? { locationLng: input.locationLng } : {}),
        ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
        ...(input.serviceAreaRadiusKm !== undefined
          ? { serviceAreaRadiusKm: input.serviceAreaRadiusKm }
          : {}),
        ...(input.offersStylistLocation !== undefined
          ? { offersStylistLocation: input.offersStylistLocation }
          : {}),
        ...(input.offersComeToClient !== undefined
          ? { offersComeToClient: input.offersComeToClient }
          : {}),
        ...(input.offersRemote !== undefined ? { offersRemote: input.offersRemote } : {}),
        ...(input.workplaceAddress !== undefined
          ? { workplaceAddress: input.workplaceAddress }
          : {}),
        ...(input.homeVisitSurcharge !== undefined
          ? { homeVisitSurcharge: input.homeVisitSurcharge }
          : {}),
      },
      include: { profile: { select: { id: true } } },
    });

    if (business.profile) {
      await prisma.stylistProfile.update({
        where: { id: business.profile.id },
        data: {
          ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.locationLabel !== undefined ? { locationArea: input.locationLabel } : {}),
          ...(input.serviceAreaRadiusKm !== undefined
            ? { serviceAreaRadiusKm: input.serviceAreaRadiusKm }
            : {}),
        },
      });
      if (input.businessName !== undefined) {
        await this.ensurePublicSlugForProfile(business.profile.id, input.businessName);
      }
    }

    return toBusinessProfile(business);
  }

  async completeOnboarding(businessId: string): Promise<BusinessProfile> {
    const activeServices = await prisma.serviceOffering.count({
      where: { businessId, active: true },
    });
    if (activeServices < 1) {
      throw ApiError.validation('Add at least one active service before completing onboarding');
    }

    const activeHours = await prisma.workingHour.count({
      where: { businessId, isActive: true },
    });
    if (activeHours < 1) {
      throw ApiError.validation('Set working hours before completing onboarding');
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: { onboardingStatus: 'complete' },
      include: { profile: { select: { id: true } } },
    });

    if (business.profile) {
      await prisma.stylistProfile.update({
        where: { id: business.profile.id },
        data: { onboardingStatus: 'complete' },
      });
    }

    return toBusinessProfile(business);
  }

  async createPortfolioUploadUrl(
    businessId: string,
    contentType: string,
    serviceOfferingId?: string | null,
  ): Promise<{
    uploadUrl: string;
    imageUrl: string;
    storageKey: string;
    expiresInSeconds: number;
    uploadToken: string;
  }> {
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw ApiError.validation('Unsupported image type. Use JPEG, PNG, or WebP.');
    }

    if (serviceOfferingId) {
      await this.assertServiceOwnedByBusiness(businessId, serviceOfferingId);
    }
    await this.assertCanAddPortfolioImage(businessId, serviceOfferingId ?? null);

    const extension =
      contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = createPortfolioStorageKey(businessId, extension);
    const storage = getStorageProvider();
    const presigned = await storage.createPresignedUploadUrl({ key, contentType });
    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';

    return {
      uploadUrl: presigned.uploadUrl,
      imageUrl: `${apiBase}${presigned.publicUrl}`,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
      uploadToken: presigned.uploadToken,
    };
  }

  async registerPortfolioItem(
    businessId: string,
    stylistId: string,
    input: RegisterPortfolioItemRequest,
  ): Promise<PortfolioItem> {
    const serviceOfferingId = input.serviceOfferingId ?? null;
    if (serviceOfferingId) {
      await this.assertServiceOwnedByBusiness(businessId, serviceOfferingId);
    }
    await this.assertCanAddPortfolioImage(businessId, serviceOfferingId);

    const maxOrder = await prisma.portfolioItem.aggregate({
      where: { businessId, serviceOfferingId },
      _max: { displayOrder: true },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        businessId,
        stylistId,
        serviceOfferingId,
        imageUrl: input.imageUrl,
        storageKey: input.storageKey,
        source: 'manual',
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    return toPortfolioItem(item);
  }

  async listPortfolioItems(
    businessId: string,
    serviceOfferingId?: string,
  ): Promise<PortfolioItem[]> {
    const items = await prisma.portfolioItem.findMany({
      where: {
        businessId,
        ...(serviceOfferingId ? { serviceOfferingId } : {}),
      },
      orderBy: [{ serviceOfferingId: 'asc' }, { displayOrder: 'asc' }],
    });
    return items.map(toPortfolioItem);
  }

  async reorderPortfolio(
    businessId: string,
    input: ReorderPortfolioRequest,
  ): Promise<PortfolioItem[]> {
    await this.assertServiceOwnedByBusiness(businessId, input.serviceOfferingId);

    const items = await prisma.portfolioItem.findMany({
      where: { businessId, serviceOfferingId: input.serviceOfferingId },
    });
    const itemIds = new Set(items.map((item) => item.id));
    if (input.orderedIds.length !== items.length) {
      throw ApiError.validation('orderedIds must include every image for this service');
    }
    for (const id of input.orderedIds) {
      if (!itemIds.has(id)) {
        throw ApiError.validation(
          'orderedIds contains an image that does not belong to this service',
        );
      }
    }

    await prisma.$transaction(
      input.orderedIds.map((id: string, index: number) =>
        prisma.portfolioItem.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.listPortfolioItems(businessId, input.serviceOfferingId);
  }

  private async assertServiceOwnedByBusiness(
    businessId: string,
    serviceOfferingId: string,
  ): Promise<void> {
    const offering = await prisma.serviceOffering.findFirst({
      where: { id: serviceOfferingId, businessId },
      select: { id: true },
    });
    if (!offering) {
      throw ApiError.notFound('Service offering not found');
    }
  }

  private async assertCanAddPortfolioImage(
    businessId: string,
    serviceOfferingId: string | null,
  ): Promise<void> {
    const [businessCount, scopedCount] = await Promise.all([
      prisma.portfolioItem.count({ where: { businessId } }),
      prisma.portfolioItem.count({
        where: { businessId, serviceOfferingId },
      }),
    ]);

    if (businessCount >= PORTFOLIO_ITEM_LIMIT) {
      throw ApiError.validation(`Portfolio limit of ${PORTFOLIO_ITEM_LIMIT} images reached`);
    }
    if (scopedCount >= PORTFOLIO_IMAGES_PER_SERVICE) {
      throw ApiError.validation(
        serviceOfferingId
          ? `This service already has the maximum of ${PORTFOLIO_IMAGES_PER_SERVICE} images`
          : `Other work already has the maximum of ${PORTFOLIO_IMAGES_PER_SERVICE} images`,
      );
    }
  }

  async deletePortfolioItem(businessId: string, itemId: string): Promise<void> {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id: itemId, businessId },
    });
    if (!existing) {
      throw ApiError.notFound('Portfolio item not found');
    }

    if (existing.storageKey) {
      await getStorageProvider().delete(existing.storageKey);
    }

    await prisma.portfolioItem.delete({ where: { id: itemId } });
  }

  async createProfilePhotoUploadUrl(
    stylistId: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    imageUrl: string;
    storageKey: string;
    expiresInSeconds: number;
    uploadToken: string;
  }> {
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw ApiError.validation('Unsupported image type. Use JPEG, PNG, or WebP.');
    }

    const extension =
      contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = createProfilePhotoStorageKey(stylistId, extension);
    const storage = getStorageProvider();
    const presigned = await storage.createPresignedUploadUrl({ key, contentType });
    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';

    return {
      uploadUrl: presigned.uploadUrl,
      imageUrl: `${apiBase}${presigned.publicUrl}`,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
      uploadToken: presigned.uploadToken,
    };
  }

  async setProfilePhoto(
    stylistId: string,
    input: RegisterProfilePhotoRequest,
  ): Promise<{ photoUrl: string }> {
    const existing = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { photoStorageKey: true },
    });
    if (!existing) {
      throw ApiError.notFound('Stylist profile not found');
    }

    if (existing.photoStorageKey && existing.photoStorageKey !== input.storageKey) {
      await getStorageProvider()
        .delete(existing.photoStorageKey)
        .catch(() => {});
    }

    const updated = await prisma.stylistProfile.update({
      where: { id: stylistId },
      data: {
        photoUrl: input.imageUrl,
        photoStorageKey: input.storageKey,
      },
      select: { photoUrl: true },
    });

    return { photoUrl: updated.photoUrl! };
  }

  async deleteProfilePhoto(stylistId: string): Promise<void> {
    const existing = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { photoStorageKey: true },
    });
    if (!existing) {
      throw ApiError.notFound('Stylist profile not found');
    }

    if (existing.photoStorageKey) {
      await getStorageProvider()
        .delete(existing.photoStorageKey)
        .catch(() => {});
    }

    await prisma.stylistProfile.update({
      where: { id: stylistId },
      data: { photoUrl: null, photoStorageKey: null },
    });
  }

  async listStyleCategories(): Promise<StyleCategory[]> {
    const categories = await prisma.styleCategory.findMany({
      where: { isCustom: false },
      include: { parent: { select: { name: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map(toStyleCategory);
  }

  async listServices(businessId: string, activeOnly = true): Promise<ServiceOffering[]> {
    const offerings = await prisma.serviceOffering.findMany({
      where: { businessId, ...(activeOnly ? { active: true } : {}) },
      include: {
        portfolioItems: {
          orderBy: { displayOrder: 'asc' },
        },
        addons: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: [{ styleName: 'asc' }, { sizeTier: 'asc' }, { lengthTier: 'asc' }],
    });
    return offerings.map((offering) =>
      toServiceOffering(
        offering,
        offering.portfolioItems.map((item) => toPortfolioItem(item)),
      ),
    );
  }

  async getServiceById(businessId: string, offeringId: string) {
    const offering = await prisma.serviceOffering.findFirst({
      where: { id: offeringId, businessId },
      include: {
        addons: { orderBy: { displayOrder: 'asc' } },
        portfolioItems: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!offering) {
      throw ApiError.notFound('Service offering not found');
    }
    return offering;
  }

  /**
   * Custom (non-seeded) style offerings are lower-confidence for AI consumers (Ch.13).
   */
  async createService(
    businessId: string,
    stylistId: string,
    input: CreateBusinessServiceRequest,
  ): Promise<ServiceOffering> {
    let styleName = input.customStyleName?.trim() ?? '';
    let styleCategoryId: string | null = null;
    let isCustomStyle = false;

    if (input.styleCategoryId) {
      const category = await prisma.styleCategory.findUnique({
        where: { id: input.styleCategoryId },
      });
      if (!category || category.isCustom) {
        throw ApiError.validation('Invalid style category');
      }
      const sizeTiers = Array.isArray(category.sizeTiers) ? category.sizeTiers : [];
      const lengthTiers = Array.isArray(category.lengthTiers) ? category.lengthTiers : [];
      if (sizeTiers.length === 0 && lengthTiers.length === 0) {
        throw ApiError.validation('Choose a specific style, not a parent category group');
      }
      styleCategoryId = category.id;
      styleName = category.name;
      isCustomStyle = false;
    } else {
      isCustomStyle = true;
    }

    const duplicate = await prisma.serviceOffering.findFirst({
      where: {
        businessId,
        active: true,
        styleName: { equals: styleName, mode: 'insensitive' },
        sizeTier: input.sizeTier ?? null,
        lengthTier: input.lengthTier ?? null,
      },
    });
    if (duplicate) {
      throw new ApiError(
        'CONFLICT',
        'A service offering with this style and tier already exists',
        409,
      );
    }

    const offering = await prisma.serviceOffering.create({
      data: {
        businessId,
        stylistId,
        styleCategoryId,
        styleName,
        sizeTier: input.sizeTier ?? null,
        lengthTier: input.lengthTier ?? null,
        basePrice: input.basePrice,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        hairIncluded: input.hairIncluded ?? false,
        isCustomStyle,
        description: input.description ?? null,
        requirements: serializeRequirements(input.requirements),
        depositType: input.depositType ?? null,
        depositValue: input.depositValue ?? null,
      },
      include: {
        addons: { orderBy: { displayOrder: 'asc' } },
        portfolioItems: { orderBy: { displayOrder: 'asc' } },
      },
    });

    return toServiceOffering(
      offering,
      offering.portfolioItems.map((item) => toPortfolioItem(item)),
    );
  }

  async updateService(
    businessId: string,
    offeringId: string,
    input: UpdateBusinessServiceRequest,
  ): Promise<ServiceOffering> {
    await this.getServiceById(businessId, offeringId);

    if (input.styleCategoryId) {
      const category = await prisma.styleCategory.findUnique({
        where: { id: input.styleCategoryId },
      });
      if (!category || category.isCustom) {
        throw ApiError.validation('Invalid style category');
      }
      const sizeTiers = Array.isArray(category.sizeTiers) ? category.sizeTiers : [];
      const lengthTiers = Array.isArray(category.lengthTiers) ? category.lengthTiers : [];
      if (sizeTiers.length === 0 && lengthTiers.length === 0) {
        throw ApiError.validation('Choose a specific style, not a parent category group');
      }
      await prisma.serviceOffering.update({
        where: { id: offeringId },
        data: {
          styleCategoryId: category.id,
          styleName: input.styleName?.trim() || category.name,
          isCustomStyle: false,
        },
      });
    } else if (input.styleCategoryId === null) {
      await prisma.serviceOffering.update({
        where: { id: offeringId },
        data: {
          styleCategoryId: null,
          isCustomStyle: true,
          ...(input.styleName || input.customStyleName
            ? { styleName: (input.styleName ?? input.customStyleName)!.trim() }
            : {}),
        },
      });
    }

    const offering = await prisma.serviceOffering.update({
      where: { id: offeringId },
      data: {
        ...(input.sizeTier !== undefined ? { sizeTier: input.sizeTier } : {}),
        ...(input.lengthTier !== undefined ? { lengthTier: input.lengthTier } : {}),
        ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
        ...(input.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: input.estimatedDurationMinutes }
          : {}),
        ...(input.hairIncluded !== undefined ? { hairIncluded: input.hairIncluded } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.requirements !== undefined
          ? { requirements: serializeRequirements(input.requirements) }
          : {}),
        ...(input.depositType !== undefined ? { depositType: input.depositType } : {}),
        ...(input.depositValue !== undefined ? { depositValue: input.depositValue } : {}),
        ...(input.customStyleName !== undefined
          ? {
              styleName: input.customStyleName.trim(),
              isCustomStyle: true,
              styleCategoryId: null,
            }
          : {}),
        ...(input.styleName !== undefined &&
        input.styleCategoryId === undefined &&
        input.customStyleName === undefined
          ? { styleName: input.styleName.trim() }
          : {}),
      },
      include: {
        addons: { orderBy: { displayOrder: 'asc' } },
        portfolioItems: { orderBy: { displayOrder: 'asc' } },
      },
    });

    return toServiceOffering(
      offering,
      offering.portfolioItems.map((item) => toPortfolioItem(item)),
    );
  }

  async deactivateService(businessId: string, offeringId: string): Promise<ServiceOffering> {
    return this.updateService(businessId, offeringId, { active: false });
  }

  async createAddon(
    businessId: string,
    serviceId: string,
    input: CreateServiceAddonRequest,
  ): Promise<ServiceAddon> {
    await this.getServiceById(businessId, serviceId);
    const count = await prisma.serviceAddon.count({ where: { serviceOfferingId: serviceId } });
    if (count >= MAX_SERVICE_ADDONS) {
      throw ApiError.validation(`Maximum of ${MAX_SERVICE_ADDONS} add-ons per service`);
    }
    const maxOrder = await prisma.serviceAddon.aggregate({
      where: { serviceOfferingId: serviceId },
      _max: { displayOrder: true },
    });
    const addon = await prisma.serviceAddon.create({
      data: {
        serviceOfferingId: serviceId,
        name: input.name.trim(),
        description: input.description ?? null,
        price: input.price,
        active: input.active ?? true,
        catalogKey: input.catalogKey ?? null,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
    return toServiceAddon(addon);
  }

  async updateAddon(
    businessId: string,
    serviceId: string,
    addonId: string,
    input: UpdateServiceAddonRequest,
  ): Promise<ServiceAddon> {
    await this.getServiceById(businessId, serviceId);
    const existing = await prisma.serviceAddon.findFirst({
      where: { id: addonId, serviceOfferingId: serviceId },
    });
    if (!existing) {
      throw ApiError.notFound('Add-on not found');
    }
    const addon = await prisma.serviceAddon.update({
      where: { id: addonId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.catalogKey !== undefined ? { catalogKey: input.catalogKey } : {}),
      },
    });
    return toServiceAddon(addon);
  }

  async deleteAddon(businessId: string, serviceId: string, addonId: string): Promise<void> {
    await this.getServiceById(businessId, serviceId);
    const existing = await prisma.serviceAddon.findFirst({
      where: { id: addonId, serviceOfferingId: serviceId },
    });
    if (!existing) {
      throw ApiError.notFound('Add-on not found');
    }
    await prisma.serviceAddon.delete({ where: { id: addonId } });
  }

  async reorderAddons(
    businessId: string,
    serviceId: string,
    input: ReorderServiceAddonsRequest,
  ): Promise<ServiceAddon[]> {
    await this.getServiceById(businessId, serviceId);
    const existing = await prisma.serviceAddon.findMany({
      where: { serviceOfferingId: serviceId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (
      input.orderedIds.length !== existingIds.size ||
      input.orderedIds.some((id) => !existingIds.has(id))
    ) {
      throw ApiError.validation(
        'orderedIds must include every add-on for this service exactly once',
      );
    }
    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.serviceAddon.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
    const addons = await prisma.serviceAddon.findMany({
      where: { serviceOfferingId: serviceId },
      orderBy: { displayOrder: 'asc' },
    });
    return addons.map(toServiceAddon);
  }

  async getPolicy(businessId: string): Promise<BusinessPolicy> {
    return ensureDefaultBusinessPolicy(businessId);
  }

  async updatePolicy(
    businessId: string,
    input: UpdateBusinessPolicyRequest,
  ): Promise<BusinessPolicy> {
    const policy = await prisma.businessPolicy.upsert({
      where: { businessId },
      create: {
        businessId,
        depositType: input.depositType,
        depositValue: input.depositValue,
        cancellationWindowHours: input.cancellationWindowHours,
        noShowFeeType: input.noShowFeeType,
        noShowFeeValue: input.noShowFeeValue ?? null,
        cancellationPolicyText: input.cancellationPolicyText ?? null,
        reschedulingPolicyText: input.reschedulingPolicyText ?? null,
        lateArrivalPolicyText: input.lateArrivalPolicyText ?? null,
        noShowPolicyText: input.noShowPolicyText ?? null,
        refundPolicyText: input.refundPolicyText ?? null,
        childrenPolicyText: input.childrenPolicyText ?? null,
        guestPolicyText: input.guestPolicyText ?? null,
        depositPolicyText: input.depositPolicyText ?? null,
        remainingBalanceMethod: input.remainingBalanceMethod ?? 'cash_or_card',
      },
      update: {
        depositType: input.depositType,
        depositValue: input.depositValue,
        cancellationWindowHours: input.cancellationWindowHours,
        noShowFeeType: input.noShowFeeType,
        noShowFeeValue: input.noShowFeeValue ?? null,
        ...(input.cancellationPolicyText !== undefined
          ? { cancellationPolicyText: input.cancellationPolicyText }
          : {}),
        ...(input.reschedulingPolicyText !== undefined
          ? { reschedulingPolicyText: input.reschedulingPolicyText }
          : {}),
        ...(input.lateArrivalPolicyText !== undefined
          ? { lateArrivalPolicyText: input.lateArrivalPolicyText }
          : {}),
        ...(input.noShowPolicyText !== undefined
          ? { noShowPolicyText: input.noShowPolicyText }
          : {}),
        ...(input.refundPolicyText !== undefined
          ? { refundPolicyText: input.refundPolicyText }
          : {}),
        ...(input.childrenPolicyText !== undefined
          ? { childrenPolicyText: input.childrenPolicyText }
          : {}),
        ...(input.guestPolicyText !== undefined ? { guestPolicyText: input.guestPolicyText } : {}),
        ...(input.depositPolicyText !== undefined
          ? { depositPolicyText: input.depositPolicyText }
          : {}),
        ...(input.remainingBalanceMethod !== undefined
          ? { remainingBalanceMethod: input.remainingBalanceMethod }
          : {}),
      },
    });

    const profile = await prisma.stylistProfile.findFirst({ where: { businessId } });
    if (profile) {
      await prisma.stylistProfile.update({
        where: { id: profile.id },
        data: {
          depositPolicy: policyToLegacyDeposit(toBusinessPolicy(policy)),
          cancellationPolicy: {
            windowHours: policy.cancellationWindowHours,
            feeType: 'percent',
            feeAmount: 50,
            noShowFeeAmount: policy.noShowFeeType === 'no_fee' ? 0 : 100,
          },
        },
      });
    }

    return toBusinessPolicy(policy);
  }
  async listWorkingHours(businessId: string): Promise<WorkingHourRow[]> {
    const rows = await prisma.workingHour.findMany({
      where: { businessId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isActive: row.isActive,
    }));
  }

  async replaceWorkingHours(
    businessId: string,
    hours: WorkingHourRow[],
  ): Promise<WorkingHourRow[]> {
    try {
      validateWorkingHourRows(hours);
    } catch (error) {
      throw ApiError.validation((error as Error).message);
    }

    await prisma.$transaction([
      prisma.workingHour.deleteMany({ where: { businessId } }),
      prisma.workingHour.createMany({
        data: hours.map((row) => ({
          id: randomUUID(),
          businessId,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          isActive: row.isActive ?? true,
        })),
      }),
    ]);

    const profile = await prisma.stylistProfile.findFirst({ where: { businessId } });
    if (profile) {
      const rules = await getBaseAvailabilityRules(
        businessId,
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      );
      await prisma.stylistProfile.update({
        where: { id: profile.id },
        data: { workingHours: baseRulesToLegacyWorkingHours(rules) },
      });
    }

    return this.listWorkingHours(businessId);
  }

  async ensureDefaultWorkingHours(businessId: string): Promise<void> {
    await ensureDefaultWorkingHoursForBusiness(businessId);
  }

  async createScheduleException(
    businessId: string,
    input: {
      date: string;
      isClosed: boolean;
      overrideStartTime?: string | null;
      overrideEndTime?: string | null;
    },
  ) {
    return prisma.scheduleException.create({
      data: {
        businessId,
        date: new Date(`${input.date}T00:00:00.000Z`),
        isClosed: input.isClosed,
        overrideStartTime: input.overrideStartTime ?? null,
        overrideEndTime: input.overrideEndTime ?? null,
      },
    });
  }

  async updateScheduleException(
    businessId: string,
    exceptionId: string,
    input: {
      isClosed?: boolean;
      overrideStartTime?: string | null;
      overrideEndTime?: string | null;
    },
  ) {
    const existing = await prisma.scheduleException.findFirst({
      where: { id: exceptionId, businessId },
    });
    if (!existing) {
      throw ApiError.notFound('Schedule exception not found');
    }

    return prisma.scheduleException.update({
      where: { id: exceptionId },
      data: {
        ...(input.isClosed !== undefined ? { isClosed: input.isClosed } : {}),
        ...(input.overrideStartTime !== undefined
          ? { overrideStartTime: input.overrideStartTime }
          : {}),
        ...(input.overrideEndTime !== undefined ? { overrideEndTime: input.overrideEndTime } : {}),
      },
    });
  }

  async deleteScheduleException(businessId: string, exceptionId: string): Promise<void> {
    const existing = await prisma.scheduleException.findFirst({
      where: { id: exceptionId, businessId },
    });
    if (!existing) {
      throw ApiError.notFound('Schedule exception not found');
    }
    await prisma.scheduleException.delete({ where: { id: exceptionId } });
  }

  async connectInstagram(
    businessId: string,
    input: { code: string; redirectUri: string },
  ): Promise<{ connected: true }> {
    return instagramService.connect({ businessId, ...input });
  }

  async importInstagram(
    businessId: string,
    stylistId: string,
    limit?: number,
  ): Promise<{ imported: number }> {
    return instagramService.importMedia({ businessId, stylistId, limit });
  }

  /** Cross-module: policy by business id (Ch.7/9). */
  getBusinessPolicy = getBusinessPolicy;
  getBaseAvailabilityRules = getBaseAvailabilityRules;
}

export const stylistProfileService = new StylistProfileService();
