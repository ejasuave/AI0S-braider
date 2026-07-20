import { describe, expect, it } from 'vitest';
import {
  formatDurationLabel,
  minutesToParts,
  partsToMinutes,
} from './service-catalogs.js';
import { buildServiceSharePathFromOffering, slugify } from './slug.js';

describe('duration helpers', () => {
  it('converts minutes to parts and back', () => {
    expect(minutesToParts(135)).toEqual({ hours: 2, minutes: 15 });
    expect(partsToMinutes(2, 15)).toBe(135);
    expect(formatDurationLabel(135)).toBe('2h 15m');
    expect(formatDurationLabel(45)).toBe('45m');
    expect(formatDurationLabel(60)).toBe('1h');
  });
});

describe('slug helpers', () => {
  it('slugifies and builds vanity paths', () => {
    expect(slugify('Bum Length')).toBe('bum-length');
    expect(
      buildServiceSharePathFromOffering({
        stylistSlug: 'eni-braids',
        styleName: 'Knotless Braids',
        styleCategorySlug: 'knotless-braids',
        sizeTier: 'Medium',
        lengthTier: 'Bum Length',
      }),
    ).toBe('/stylist/eni-braids/knotless-braids/medium/bum-length');
  });
});
