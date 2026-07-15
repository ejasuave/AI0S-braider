import type { Prisma } from '@prisma/client';
import type {
  BusinessPolicy,
  BusinessProfile,
  PortfolioItem,
  ServiceAddon,
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
  cancellationPolicyText?: string | null;
  reschedulingPolicyText?: string | null;
  lateArrivalPolicyText?: string | null;
  noShowPolicyText?: string | null;
  refundPolicyText?: string | null;
  childrenPolicyText?: string | null;
  guestPolicyText?: string | null;
  depositPolicyText?: string | null;
  remainingBalanceMethod?: 'cash' | 'card' | 'cash_or_card';
}): BusinessPolicy {
  return {
    businessId: row.businessId,
    depositType: row.depositType,
    depositValue: row.depositValue.toNumber(),
    cancellationWindowHours: row.cancellationWindowHours,
    noShowFeeType: row.noShowFeeType,
    noShowFeeValue: row.noShowFeeValue ? row.noShowFeeValue.toNumber() : null,
    cancellationPolicyText: row.cancellationPolicyText ?? null,
    reschedulingPolicyText: row.reschedulingPolicyText ?? null,
    lateArrivalPolicyText: row.lateArrivalPolicyText ?? null,
    noShowPolicyText: row.noShowPolicyText ?? null,
    refundPolicyText: row.refundPolicyText ?? null,
    childrenPolicyText: row.childrenPolicyText ?? null,
    guestPolicyText: row.guestPolicyText ?? null,
    depositPolicyText: row.depositPolicyText ?? null,
    remainingBalanceMethod: row.remainingBalanceMethod ?? 'cash_or_card',
  };
}

export function toServiceAddon(addon: {
  id: string;
  serviceOfferingId: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  active: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ServiceAddon {
  return {
    id: addon.id,
    serviceOfferingId: addon.serviceOfferingId,
    name: addon.name,
    description: addon.description,
    price: addon.price.toFixed(2),
    active: addon.active,
    displayOrder: addon.displayOrder,
    createdAt: toIso(addon.createdAt),
    updatedAt: toIso(addon.updatedAt),
  };
}

function parseRequirements(value: Prisma.JsonValue | string[] | null | undefined): string[] {
  if (!value || !Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') result.push(item);
  }
  return result;
}

export function toServiceOffering(
  offering: {
    id: string;
    businessId: string;
    stylistId: string;
    styleCategoryId: string | null;
    styleName: string;
    sizeTier: string | null;
    lengthTier: string | null;
    description?: string | null;
    requirements?: Prisma.JsonValue | string[] | null;
    basePrice: Prisma.Decimal;
    estimatedDurationMinutes: number;
    hairIncluded: boolean;
    isCustomStyle: boolean;
    active: boolean;
    depositType?: 'flat' | 'percentage' | null;
    depositValue?: Prisma.Decimal | null;
    createdAt: Date;
    updatedAt: Date;
    addons?: Array<{
      id: string;
      serviceOfferingId: string;
      name: string;
      description: string | null;
      price: Prisma.Decimal;
      active: boolean;
      displayOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  },
  portfolio: PortfolioItem[] = [],
): ServiceOffering {
  return {
    id: offering.id,
    stylistId: offering.stylistId,
    styleCategoryId: offering.styleCategoryId,
    styleName: offering.styleName,
    sizeTier: offering.sizeTier,
    lengthTier: offering.lengthTier,
    description: offering.description ?? null,
    requirements: parseRequirements(offering.requirements),
    basePrice: offering.basePrice.toString(),
    estimatedDurationMinutes: offering.estimatedDurationMinutes,
    hairIncluded: offering.hairIncluded,
    isCustomStyle: offering.isCustomStyle,
    active: offering.active,
    depositType: offering.depositType ?? null,
    depositValue: offering.depositValue != null ? offering.depositValue.toNumber() : null,
    addons: (offering.addons ?? []).map(toServiceAddon),
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
  source: 'manual' | 'instagram';
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

/** Business-wide portfolio cap (manual + Instagram) — prevents unbounded storage. */
export const PORTFOLIO_ITEM_LIMIT = 50;

/** Per-service gallery cap (product requirement). */
export const PORTFOLIO_IMAGES_PER_SERVICE = 10;

export const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024;

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
