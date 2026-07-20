import type {
  OnboardingStatus,
  PortfolioItem,
  PortfolioSource,
  ServiceOffering,
  StylistProfile,
  StyleCategory,
} from '@project-braids/shared-types/api';
import {
  DEFAULT_CANCELLATION_POLICY,
  DEFAULT_DEPOSIT_POLICY,
  DEFAULT_WORKING_HOURS,
} from '@project-braids/shared-types/api';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { businessService } from '../roles/business.service.js';
import { ensureDefaultWorkingHoursForBusiness } from '../stylist-profile/availability.js';
import { ApiError } from '../../lib/errors.js';

function toIso(date: Date): string {
  return date.toISOString();
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function toStylistProfile(profile: {
  id: string;
  userId: string;
  businessName: string;
  publicSlug?: string | null;
  bio: string | null;
  locationArea: string | null;
  serviceAreaRadiusKm: Prisma.Decimal | null;
  cancellationPolicy: Prisma.JsonValue | null;
  depositPolicy: Prisma.JsonValue | null;
  workingHours: Prisma.JsonValue | null;
  bufferMinutes: number;
  onboardingStatus: OnboardingStatus;
  directoryVisible: boolean;
  photoUrl: string | null;
  googlePlaceId?: string | null;
  googleBusinessProfileUrl?: string | null;
  googleReviewsLinkedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StylistProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    businessName: profile.businessName,
    publicSlug: profile.publicSlug ?? null,
    bio: profile.bio,
    locationArea: profile.locationArea,
    serviceAreaRadiusKm: decimalToNumber(profile.serviceAreaRadiusKm),
    cancellationPolicy: profile.cancellationPolicy as StylistProfile['cancellationPolicy'],
    depositPolicy: profile.depositPolicy as StylistProfile['depositPolicy'],
    workingHours: profile.workingHours as StylistProfile['workingHours'],
    bufferMinutes: profile.bufferMinutes,
    onboardingStatus: profile.onboardingStatus,
    directoryVisible: profile.directoryVisible,
    photoUrl: profile.photoUrl,
    googlePlaceId: profile.googlePlaceId ?? null,
    googleBusinessProfileUrl: profile.googleBusinessProfileUrl ?? null,
    googleReviewsLinkedAt: profile.googleReviewsLinkedAt
      ? toIso(profile.googleReviewsLinkedAt)
      : null,
    createdAt: toIso(profile.createdAt),
    updatedAt: toIso(profile.updatedAt),
  };
}

export function toServiceOffering(
  offering: {
    id: string;
    stylistId: string;
    styleName: string;
    sizeTier: string | null;
    lengthTier: string | null;
    basePrice: Prisma.Decimal;
    estimatedDurationMinutes: number;
    hairIncluded: boolean;
    isCustomStyle: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  portfolio: PortfolioItem[] = [],
): ServiceOffering {
  return {
    id: offering.id,
    stylistId: offering.stylistId,
    styleName: offering.styleName,
    sizeTier: offering.sizeTier,
    lengthTier: offering.lengthTier,
    description: null,
    requirements: [],
    basePrice: offering.basePrice.toString(),
    estimatedDurationMinutes: offering.estimatedDurationMinutes,
    hairIncluded: offering.hairIncluded,
    isCustomStyle: offering.isCustomStyle,
    active: offering.active,
    depositType: null,
    depositValue: null,
    addons: [],
    portfolio,
    createdAt: toIso(offering.createdAt),
    updatedAt: toIso(offering.updatedAt),
  };
}

export function toPortfolioItem(item: {
  id: string;
  stylistId: string;
  serviceOfferingId: string | null;
  imageUrl: string;
  source: PortfolioSource;
  displayOrder: number;
  createdAt: Date;
}): PortfolioItem {
  return {
    id: item.id,
    stylistId: item.stylistId,
    serviceOfferingId: item.serviceOfferingId,
    imageUrl: item.imageUrl,
    source: item.source,
    displayOrder: item.displayOrder,
    createdAt: toIso(item.createdAt),
  };
}

export function toStyleCategory(category: {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sizeTiers: Prisma.JsonValue;
  lengthTiers: Prisma.JsonValue;
  sortOrder: number;
  parent?: { name: string } | null;
}): StyleCategory {
  const sizeTiers = category.sizeTiers as string[];
  const lengthTiers = category.lengthTiers as string[];
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ?? null,
    parentName: category.parent?.name ?? null,
    isGroup: sizeTiers.length === 0 && lengthTiers.length === 0,
    sizeTiers,
    lengthTiers,
    sortOrder: category.sortOrder,
  };
}

export async function ensureStylistProfileForUser(userId: string) {
  const existing = await prisma.stylistProfile.findUnique({ where: { userId } });
  if (existing) {
    if (existing.businessId) {
      await ensureDefaultWorkingHoursForBusiness(existing.businessId);
    }
    return existing;
  }

  return prisma.stylistProfile
    .create({
      data: {
        userId,
        businessName: '',
        depositPolicy: DEFAULT_DEPOSIT_POLICY,
        cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
        workingHours: DEFAULT_WORKING_HOURS,
        onboardingStatus: 'in_progress',
      },
    })
    .then(async (profile) => {
      const business = await businessService.ensureBusinessForOwner(userId, profile.businessName);
      if (!profile.businessId) {
        return prisma.stylistProfile.update({
          where: { id: profile.id },
          data: { businessId: business.id },
        });
      }
      return profile;
    })
    .then(async (profile) => {
      if (profile.businessId) {
        await ensureDefaultWorkingHoursForBusiness(profile.businessId);
      }
      return profile;
    });
}

export async function getStylistProfileById(stylistId: string) {
  const profile = await prisma.stylistProfile.findUnique({ where: { id: stylistId } });
  if (!profile) {
    throw ApiError.notFound('Stylist profile not found');
  }
  return profile;
}

export async function listActiveServiceOfferings(stylistId: string) {
  return prisma.serviceOffering.findMany({
    where: { stylistId, active: true },
    orderBy: [{ styleName: 'asc' }, { sizeTier: 'asc' }, { lengthTier: 'asc' }],
  });
}

export async function findDuplicateOffering(
  stylistId: string,
  styleName: string,
  sizeTier: string | null,
  lengthTier: string | null,
  excludeId?: string,
) {
  return prisma.serviceOffering.findFirst({
    where: {
      stylistId,
      active: true,
      styleName: { equals: styleName, mode: 'insensitive' },
      sizeTier: sizeTier ?? null,
      lengthTier: lengthTier ?? null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}
