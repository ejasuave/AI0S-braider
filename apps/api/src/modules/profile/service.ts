import { randomUUID } from 'node:crypto';
import type {
  CreatePortfolioItemRequest,
  CreateServiceOfferingRequest,
  PricingLookupRequest,
  PricingLookupResponse,
  PortfolioItem,
  ServiceOffering,
  StylistProfile,
  StyleCategory,
  UpdatePortfolioItemRequest,
  UpdateServiceOfferingRequest,
  UpdateStylistProfileRequest,
} from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getStorageProvider } from '../../lib/storage/index.js';
import { resolvePricingLookup } from './pricing-lookup.js';
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

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ProfileService {
  async getOrCreateProfile(userId: string): Promise<StylistProfile> {
    const profile = await ensureStylistProfileForUser(userId);
    return toStylistProfile(profile);
  }

  async updateProfile(stylistId: string, input: UpdateStylistProfileRequest): Promise<StylistProfile> {
    await getStylistProfileById(stylistId);

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
        ...(input.workingHours !== undefined ? { workingHours: input.workingHours } : {}),
        ...(input.bufferMinutes !== undefined ? { bufferMinutes: input.bufferMinutes } : {}),
        ...(input.onboardingStatus !== undefined
          ? { onboardingStatus: input.onboardingStatus }
          : {}),
      },
    });

    return toStylistProfile(profile);
  }

  async listStyleCategories(): Promise<StyleCategory[]> {
    const categories = await prisma.styleCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map(toStyleCategory);
  }

  async listServiceOfferings(stylistId: string): Promise<ServiceOffering[]> {
    const offerings = await listActiveServiceOfferings(stylistId);
    return offerings.map(toServiceOffering);
  }

  async createServiceOffering(
    stylistId: string,
    input: CreateServiceOfferingRequest,
  ): Promise<ServiceOffering> {
    const sizeTier = input.sizeTier ?? null;
    const lengthTier = input.lengthTier ?? null;

    const duplicate = await findDuplicateOffering(
      stylistId,
      input.styleName,
      sizeTier,
      lengthTier,
    );
    if (duplicate) {
      throw new ApiError(
        'CONFLICT',
        'A service offering with this style and tier combination already exists',
        409,
      );
    }

    const offering = await prisma.serviceOffering.create({
      data: {
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

  async lookupPricing(stylistId: string, input: PricingLookupRequest): Promise<PricingLookupResponse> {
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

    const maxOrder = await prisma.portfolioItem.aggregate({
      where: { stylistId },
      _max: { displayOrder: true },
    });

    const item = await prisma.portfolioItem.create({
      data: {
        stylistId,
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

    const extension = file.contentType === 'image/png'
      ? 'png'
      : file.contentType === 'image/webp'
        ? 'webp'
        : 'jpg';
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
    return {
      bufferMinutes: profile.bufferMinutes,
      depositPolicy: profile.depositPolicy as { type: 'flat' | 'percent'; value: number } | null,
    };
  }
}

export const profileService = new ProfileService();
