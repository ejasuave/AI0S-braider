import { describe, expect, it } from 'vitest';
import {
  clientDeclinesAddons,
  formatPriceQuote,
  missingTierClarification,
  resolveAddonIds,
} from './addons.js';
import type { StylistOffering } from './addons.js';

const offeringWithAddons: StylistOffering = {
  id: '11111111-1111-4111-8111-111111111111',
  styleName: 'Box braids',
  sizeTier: 'Medium',
  lengthTier: null,
  basePrice: '80.00',
  estimatedDurationMinutes: 180,
  isCustomStyle: false,
  requirements: ['Bring hair'],
  addons: [
    { id: '22222222-2222-4222-8222-222222222222', name: 'Boho curls', price: '25.00' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Beads', price: '10.00' },
  ],
};

describe('resolveAddonIds', () => {
  it('maps addon names to ids case-insensitively', () => {
    expect(resolveAddonIds(offeringWithAddons, ['boho curls', 'Beads'])).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ]);
  });

  it('returns empty when none selected', () => {
    expect(resolveAddonIds(offeringWithAddons, [])).toEqual([]);
    expect(resolveAddonIds(offeringWithAddons, undefined)).toEqual([]);
  });
});

describe('formatPriceQuote', () => {
  it('includes selected addon prices in the total', () => {
    const quote = formatPriceQuote(offeringWithAddons, ['Boho curls']);
    expect(quote.total).toBe(105);
    expect(quote.line).toMatch(/£105\.00/);
    expect(quote.line).toMatch(/Boho curls/);
    expect(quote.requirementsNote).toMatch(/Bring hair/);
  });
});

describe('missingTierClarification', () => {
  it('asks for size when multiple size tiers exist', () => {
    const offerings: StylistOffering[] = [
      { ...offeringWithAddons, id: 'a', sizeTier: 'Small', addons: [] },
      { ...offeringWithAddons, id: 'b', sizeTier: 'Large', addons: [] },
    ];
    expect(missingTierClarification(offerings, { styleName: 'Box braids' })).toEqual({
      field: 'sizeTier',
      options: ['Small', 'Large'],
    });
  });
});

describe('clientDeclinesAddons', () => {
  it('detects none / no add-ons replies', () => {
    expect(clientDeclinesAddons('none')).toBe(true);
    expect(clientDeclinesAddons('no add-ons thanks')).toBe(true);
    expect(clientDeclinesAddons('boho curls please')).toBe(false);
  });
});
