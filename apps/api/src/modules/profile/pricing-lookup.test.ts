import { describe, expect, it } from 'vitest';
import { resolvePricingLookup } from './pricing-lookup.js';

const stylistId = '11111111-1111-1111-1111-111111111111';
const businessId = '33333333-3333-3333-3333-333333333333';
const now = new Date();

function offering(input: {
  styleName: string;
  sizeTier?: string | null;
  lengthTier?: string | null;
  isCustomStyle?: boolean;
}) {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    businessId,
    stylistId,
    styleCategoryId: null,
    styleName: input.styleName,
    sizeTier: input.sizeTier ?? null,
    lengthTier: input.lengthTier ?? null,
    description: null,
    requirements: [],
    depositType: null,
    depositValue: null,
    basePrice: { toString: () => '120.00' } as never,
    estimatedDurationMinutes: 240,
    hairIncluded: false,
    isCustomStyle: input.isCustomStyle ?? false,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('resolvePricingLookup', () => {
  it('returns exact match with full confidence for seeded styles', () => {
    const result = resolvePricingLookup(
      [offering({ styleName: 'Knotless Braids', sizeTier: 'Medium', lengthTier: 'Waist-length' })],
      {
        styleName: 'knotless braids',
        sizeTier: 'medium',
        lengthTier: 'waist-length',
      },
    );

    expect(result.matchType).toBe('exact');
    expect(result.confidence).toBe(1);
    expect(result.offering?.styleName).toBe('Knotless Braids');
  });

  it('falls back to partial size match', () => {
    const result = resolvePricingLookup(
      [offering({ styleName: 'Box Braids', sizeTier: 'Large', lengthTier: null })],
      { styleName: 'Box Braids', sizeTier: 'Large', lengthTier: 'Waist-length' },
    );

    expect(result.matchType).toBe('partial_size');
    expect(result.confidence).toBe(0.9);
  });

  it('falls back to style-only match', () => {
    const result = resolvePricingLookup(
      [offering({ styleName: 'Cornrows', sizeTier: null, lengthTier: null })],
      { styleName: 'Cornrows', sizeTier: 'Medium' },
    );

    expect(result.matchType).toBe('partial_style');
    expect(result.confidence).toBe(0.8);
  });

  it('returns none when no offering matches', () => {
    const result = resolvePricingLookup([], { styleName: 'Custom Style' });
    expect(result.matchType).toBe('none');
    expect(result.confidence).toBe(0);
    expect(result.offering).toBeNull();
  });

  it('lowers confidence for custom styles', () => {
    const result = resolvePricingLookup(
      [offering({ styleName: 'Boho Locs', sizeTier: null, lengthTier: null, isCustomStyle: true })],
      { styleName: 'Boho Locs' },
    );

    expect(result.matchType).toBe('exact');
    expect(result.confidence).toBe(0.85);
  });
});
