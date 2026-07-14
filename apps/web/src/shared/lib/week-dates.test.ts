import { describe, expect, it } from 'vitest';
import {
  bookingOnDateKey,
  getMultiWeekRangeIso,
  getWeekDays,
  shiftWeekAnchor,
  todayDateKey,
} from './week-dates';

describe('week-dates', () => {
  it('returns seven days starting Monday', () => {
    const days = getWeekDays(new Date('2026-07-13T12:00:00'));
    expect(days).toHaveLength(7);
    expect(days[0]?.weekdayLabel).toBe('Mon');
    expect(days[0]?.weekdayInitial).toBe('M');
    expect(days[6]?.weekdayLabel).toBe('Sun');
    expect(days[6]?.weekdayInitial).toBe('S');
  });

  it('marks today in the week strip', () => {
    const days = getWeekDays(new Date());
    expect(days.some((day) => day.isToday && day.dateKey === todayDateKey())).toBe(true);
  });

  it('matches bookings to a date key', () => {
    const localStart = new Date(2026, 6, 13, 10, 30, 0);
    const dateKey = '2026-07-13';
    expect(bookingOnDateKey(localStart.toISOString(), dateKey)).toBe(true);
    expect(bookingOnDateKey(localStart.toISOString(), '2026-07-14')).toBe(false);
  });

  it('shifts week anchor by whole weeks', () => {
    const anchor = new Date('2026-07-13T12:00:00');
    const next = shiftWeekAnchor(anchor, 1);
    expect(getWeekDays(next)[0]?.dateKey).toBe('2026-07-20');
  });

  it('extends fetch range across multiple weeks', () => {
    const anchor = new Date('2026-07-12T12:00:00'); // Sunday
    const range = getMultiWeekRangeIso(anchor, 2);
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    expect(toMs - fromMs).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
  });
});
