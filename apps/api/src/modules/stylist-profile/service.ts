import { randomUUID } from 'node:crypto';
import type {
  BusinessPolicy,
  BusinessProfile,
  CreateBusinessServiceRequest,
  PortfolioItem,
  RegisterPortfolioItemRequest,
  RegisterProfilePhotoRequest,
  ReorderPortfolioRequest,
  ServiceOffering,
  StyleCategory,
  UpdateBusinessPolicyRequest,
  UpdateBusinessProfileRequest,
  UpdateBusinessServiceRequest,
  WorkingHourRow,
} from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import {
  createPortfolioStorageKey,
  createProfilePhotoStorageKey,
  getStorageProvider,
} from '../../lib/storage/index.js';
import { businessService } from '../roles/business.service.js';
import { ensureStylistProfileForUser } from '../profile/mappers.js';
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
  toServiceOffering,
  toStyleCategory,
} from './mappers.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class StylistProfileService {
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

    const offersStylistLocation =
      input.offersStylistLocation ?? existing.offersStylistLocation;
    const offersComeToClient = input.offersComeToClient ?? existing.offersComeToClient;
    const offersRemote = input.offersRemote ?? existing.offersRemote;

    if (!offersStylistLocation && !offersComeToClient && !offersRemote) {
      throw ApiError.validation('Select at least one venue option');
    }

    const nextWorkplace =
      input.workplaceAddress !== undefined ? input.workplaceAddress : existing.workplaceAddress;

    if (offersStylistLocation && (!nextWorkplace || nextWorkplace.trim().length < 5)) {
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
    serviceOfferingId: string,
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

    await this.assertServiceOwnedByBusiness(businessId, serviceOfferingId);
    await this.assertCanAddPortfolioImage(businessId, serviceOfferingId);

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
    await this.assertServiceOwnedByBusiness(businessId, input.serviceOfferingId);
    await this.assertCanAddPortfolioImage(businessId, input.serviceOfferingId);

    const maxOrder = await prisma.portfolioItem.aggregate({
      where: { businessId, serviceOfferingId: input.serviceOfferingId },
      _max: { displayOrder: true },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        businessId,
        stylistId,
        serviceOfferingId: input.serviceOfferingId,
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
        throw ApiError.validation('orderedIds contains an image that does not belong to this service');
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
    serviceOfferingId: string,
  ): Promise<void> {
    const [businessCount, serviceCount] = await Promise.all([
      prisma.portfolioItem.count({ where: { businessId } }),
      prisma.portfolioItem.count({ where: { businessId, serviceOfferingId } }),
    ]);

    if (businessCount >= PORTFOLIO_ITEM_LIMIT) {
      throw ApiError.validation(`Portfolio limit of ${PORTFOLIO_ITEM_LIMIT} images reached`);
    }
    if (serviceCount >= PORTFOLIO_IMAGES_PER_SERVICE) {
      throw ApiError.validation(
        `This service already has the maximum of ${PORTFOLIO_IMAGES_PER_SERVICE} images`,
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
      await getStorageProvider().delete(existing.photoStorageKey).catch(() => {});
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
      await getStorageProvider().delete(existing.photoStorageKey).catch(() => {});
    }

    await prisma.stylistProfile.update({
      where: { id: stylistId },
      data: { photoUrl: null, photoStorageKey: null },
    });
  }

  async listStyleCategories(): Promise<StyleCategory[]> {
    const categories = await prisma.styleCategory.findMany({
      where: { isCustom: false },
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
      },
    });

    return toServiceOffering(offering);
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
      await prisma.serviceOffering.update({
        where: { id: offeringId },
        data: {
          styleCategoryId: category.id,
          styleName: category.name,
          isCustomStyle: false,
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
        ...(input.customStyleName !== undefined
          ? {
              styleName: input.customStyleName.trim(),
              isCustomStyle: true,
              styleCategoryId: null,
            }
          : {}),
      },
    });

    return toServiceOffering(offering);
  }

  async deactivateService(businessId: string, offeringId: string): Promise<ServiceOffering> {
    return this.updateService(businessId, offeringId, { active: false });
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
      },
      update: {
        depositType: input.depositType,
        depositValue: input.depositValue,
        cancellationWindowHours: input.cancellationWindowHours,
        noShowFeeType: input.noShowFeeType,
        noShowFeeValue: input.noShowFeeValue ?? null,
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
