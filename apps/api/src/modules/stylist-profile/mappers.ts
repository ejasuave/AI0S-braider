import type { Prisma } from '@prisma/client';
import type {
  BusinessPolicy,
  BusinessProfile,
  PortfolioItem,
  ServiceOffering,
  StyleCategory,
} from '@project-braids/shared-types/api';

function toIso(date: Date): string {
  return date.toISOString();
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function toBusinessProfile(row: {
  id: string;
  ownerUserId: string;
  businessName: string;
  bio: string | null;
  locationLat: Prisma.Decimal | null;
  locationLng: Prisma.Decimal | null;
  locationLabel: string | null;
  serviceAreaRadiusKm: Prisma.Decimal | null;
  offersStylistLocation: boolean;
  offersComeToClient: boolean;
  offersRemote: boolean;
  workplaceAddress: string | null;
  homeVisitSurcharge: Prisma.Decimal | null;
  onboardingStatus: 'in_progress' | 'complete';
  createdAt: Date;
  profile?: { id: string } | null;
}): BusinessProfile {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    businessName: row.businessName,
    bio: row.bio,
    locationLat: decimalToNumber(row.locationLat),
    locationLng: decimalToNumber(row.locationLng),
    locationLabel: row.locationLabel,
    serviceAreaRadiusKm: decimalToNumber(row.serviceAreaRadiusKm),
    offersStylistLocation: row.offersStylistLocation,
    offersComeToClient: row.offersComeToClient,
    offersRemote: row.offersRemote,
    workplaceAddress: row.workplaceAddress,
    homeVisitSurcharge: row.homeVisitSurcharge ? row.homeVisitSurcharge.toFixed(2) : null,
    onboardingStatus: row.onboardingStatus,
    stylistId: row.profile?.id ?? null,
    createdAt: toIso(row.createdAt),
  };
}

export function toBusinessPolicy(row: {
  businessId: string;
  depositType: 'flat' | 'percentage';
  depositValue: Prisma.Decimal;
  cancellationWindowHours: number;
  noShowFeeType: 'forfeit_deposit' | 'flat_fee' | 'no_fee';
  noShowFeeValue: Prisma.Decimal | null;
}): BusinessPolicy {
  return {
    businessId: row.businessId,
    depositType: row.depositType,
    depositValue: row.depositValue.toNumber(),
    cancellationWindowHours: row.cancellationWindowHours,
    noShowFeeType: row.noShowFeeType,
    noShowFeeValue: row.noShowFeeValue ? row.noShowFeeValue.toNumber() : null,
  };
}

export function toServiceOffering(offering: {
  id: string;
  businessId: string;
  stylistId: string;
  styleCategoryId: string | null;
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
}): ServiceOffering {
  return {
    id: offering.id,
    stylistId: offering.stylistId,
    styleName: offering.styleName,
    sizeTier: offering.sizeTier,
    lengthTier: offering.lengthTier,
    basePrice: offering.basePrice.toString(),
    estimatedDurationMinutes: offering.estimatedDurationMinutes,
    hairIncluded: offering.hairIncluded,
    isCustomStyle: offering.isCustomStyle,
    active: offering.active,
    createdAt: toIso(offering.createdAt),
    updatedAt: toIso(offering.updatedAt),
  };
}

export function toPortfolioItem(item: {
  id: string;
  stylistId: string;
  imageUrl: string;
  source: 'manual' | 'instagram';
  displayOrder: number;
  createdAt: Date;
}): PortfolioItem {
  return {
    id: item.id,
    stylistId: item.stylistId,
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
  isCustom: boolean;
  sizeTiers: Prisma.JsonValue;
  lengthTiers: Prisma.JsonValue;
  sortOrder: number;
}): StyleCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sizeTiers: category.sizeTiers as string[],
    lengthTiers: category.lengthTiers as string[],
    sortOrder: category.sortOrder,
  };
}

export const PORTFOLIO_ITEM_LIMIT = 50;

export const WEEKDAY_INDEX_TO_NAME = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
