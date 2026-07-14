import { describe, expect, it } from 'vitest';
import {
  generateAvailabilitySlots,
  padBlockingBookings,
  slotMatchesAvailability,
} from './availability.js';

const mondayOpen = {
  date: '2026-08-03',
  isClosed: false,
  ranges: [{ start: '09:00', end: '17:00' }],
};

describe('padBlockingBookings', () => {
  it('pads bookings on both sides by buffer minutes', () => {
    const start = new Date('2026-08-03T13:00:00.000Z');
    const end = new Date('2026-08-03T15:00:00.000Z');
    const padded = padBlockingBookings([{ startTime: start, endTime: end }], 15)[0]!;
    expect(padded.startTime.toISOString()).toBe('2026-08-03T12:45:00.000Z');
    expect(padded.endTime.toISOString()).toBe('2026-08-03T15:15:00.000Z');
  });
});

describe('generateAvailabilitySlots', () => {
  it('returns duration-aware slots within working hours', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      dayRules: [mondayOpen],
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

  it('excludes a 5-hour slot at 1pm when a 4pm booking blocks the full span', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      dayRules: [mondayOpen],
      durationMinutes: 300,
      bufferMinutes: 0,
      slotIntervalMinutes: 60,
      blockingBookings: [
        {
          startTime: new Date('2026-08-03T15:00:00.000Z'),
          endTime: new Date('2026-08-03T16:00:00.000Z'),
        },
      ],
      limit: 50,
    });

    const onePmLondon = new Date('2026-08-03T12:00:00.000Z').toISOString();
    expect(slots.some((slot) => slot.startTime === onePmLondon)).toBe(false);
  });

  it('excludes 4:00pm and 4:10pm but includes 4:15pm with a 15-minute buffer after a 2-4pm booking', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      dayRules: [mondayOpen],
      durationMinutes: 30,
      bufferMinutes: 15,
      slotIntervalMinutes: 15,
      blockingBookings: [
        {
          startTime: new Date('2026-08-03T13:00:00.000Z'),
          endTime: new Date('2026-08-03T15:00:00.000Z'),
        },
      ],
      limit: 50,
    });

    const starts = slots.map((slot) => slot.startTime);
    expect(starts).not.toContain(new Date('2026-08-03T15:00:00.000Z').toISOString());
    expect(starts).not.toContain(new Date('2026-08-03T15:10:00.000Z').toISOString());
    expect(starts).toContain(new Date('2026-08-03T15:15:00.000Z').toISOString());
  });

  it('matches a generated slot by exact start time', () => {
    const slots = generateAvailabilitySlots({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.999Z'),
      now: new Date('2026-08-02T00:00:00.000Z'),
      timeZone: 'Europe/London',
      dayRules: [mondayOpen],
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
