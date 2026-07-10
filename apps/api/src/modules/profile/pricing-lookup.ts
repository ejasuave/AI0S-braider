import type { ServiceOffering as DbServiceOffering } from '@prisma/client';
import type {
  PricingLookupMatchType,
  PricingLookupResponse,
  ServiceOffering,
} from '@project-braids/shared-types/api';

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function toApiOffering(offering: DbServiceOffering): ServiceOffering {
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
    createdAt: offering.createdAt.toISOString(),
    updatedAt: offering.updatedAt.toISOString(),
  };
}

export function resolvePricingLookup(
  offerings: DbServiceOffering[],
  input: { styleName: string; sizeTier?: string; lengthTier?: string },
): PricingLookupResponse {
  const activeOfferings = offerings.filter((offering) => offering.active);
  const styleName = normalize(input.styleName);
  const sizeTier = normalize(input.sizeTier);
  const lengthTier = normalize(input.lengthTier);

  const exact = activeOfferings.find((offering) => {
    return (
      normalize(offering.styleName) === styleName &&
      normalize(offering.sizeTier) === sizeTier &&
      normalize(offering.lengthTier) === lengthTier
    );
  });

  if (exact) {
    const confidence = exact.isCustomStyle ? 0.85 : 1;
    return {
      offering: toApiOffering(exact),
      confidence,
      matchType: 'exact',
    };
  }

  if (sizeTier) {
    const partialSize = activeOfferings.find((offering) => {
      return (
        normalize(offering.styleName) === styleName &&
        normalize(offering.sizeTier) === sizeTier &&
        normalize(offering.lengthTier) === null
      );
    });

    if (partialSize) {
      return {
        offering: toApiOffering(partialSize),
        confidence: partialSize.isCustomStyle ? 0.75 : 0.9,
        matchType: 'partial_size',
      };
    }
  }

  const partialStyle = activeOfferings.find((offering) => {
    return (
      normalize(offering.styleName) === styleName &&
      normalize(offering.sizeTier) === null &&
      normalize(offering.lengthTier) === null
    );
  });

  if (partialStyle) {
    return {
      offering: toApiOffering(partialStyle),
      confidence: partialStyle.isCustomStyle ? 0.7 : 0.8,
      matchType: 'partial_style',
    };
  }

  return {
    offering: null,
    confidence: 0,
    matchType: 'none' satisfies PricingLookupMatchType,
  };
}
