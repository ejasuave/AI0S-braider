import { describe, expect, it } from 'vitest';
import { intervalsOverlap } from './conflict.js';

describe('intervalsOverlap', () => {
  it('detects overlapping intervals', () => {
    const aStart = new Date('2026-07-15T10:00:00.000Z');
    const aEnd = new Date('2026-07-15T12:00:00.000Z');
    const bStart = new Date('2026-07-15T11:00:00.000Z');
    const bEnd = new Date('2026-07-15T13:00:00.000Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it('returns false for adjacent non-overlapping intervals', () => {
    const aStart = new Date('2026-07-15T10:00:00.000Z');
    const aEnd = new Date('2026-07-15T12:00:00.000Z');
    const bStart = new Date('2026-07-15T12:00:00.000Z');
    const bEnd = new Date('2026-07-15T14:00:00.000Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
