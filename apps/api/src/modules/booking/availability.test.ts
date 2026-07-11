import { describe, expect, it } from 'vitest';
import { generateAvailabilitySlots, slotMatchesAvailability } from './availability.js';

const workingHours = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '10:00', end: '16:00' },
  sunday: { enabled: false, start: '10:00', end: '16:00' },
};

describe('generateAvailabilitySlots', () => {
  it('returns duration-aware slots within working hours', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      workingHours,
      durationMinutes: 180,
      bufferMinutes: 15,
      slotIntervalMinutes: 60,
      blockingBookings: [],
      limit: 10,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.durationMinutes).toBe(180);
    expect(slots[0]?.bufferMinutes).toBe(15);

    const firstStart = new Date(slots[0]!.startTime);
    const firstEnd = new Date(slots[0]!.endTime);
    expect((firstEnd.getTime() - firstStart.getTime()) / 60_000).toBe(195);
  });

  it('excludes slots overlapping existing bookings', () => {
    const blockingStart = new Date('2026-08-03T10:00:00.000Z');
    const blockingEnd = new Date('2026-08-03T13:15:00.000Z');

    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      workingHours,
      durationMinutes: 180,
      bufferMinutes: 15,
      slotIntervalMinutes: 60,
      blockingBookings: [{ startTime: blockingStart, endTime: blockingEnd }],
      limit: 20,
    });

    expect(slots.some((slot) => slot.startTime === blockingStart.toISOString())).toBe(false);
  });

  it('matches a generated slot by exact start time', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      workingHours,
      durationMinutes: 60,
      bufferMinutes: 0,
      slotIntervalMinutes: 60,
      blockingBookings: [],
      limit: 5,
    });

    expect(slotMatchesAvailability(slots, new Date(slots[0]!.startTime))).toBe(true);
    expect(slotMatchesAvailability(slots, new Date('2026-08-03T03:33:00.000Z'))).toBe(false);
  });
});
