import type { AvailabilitySlot } from '@project-braids/shared-types/api';
import type { AvailabilityDayRule } from '../stylist-profile/availability.js';
import { intervalsOverlap } from '../booking/conflict.js';
import { wallClockToUtc } from '../../lib/scheduling/timezone.js';

type BlockingBooking = {
  startTime: Date;
  endTime: Date;
};

export type GenerateAvailabilityInput = {
  from: Date;
  to: Date;
  now?: Date;
  timeZone: string;
  dayRules: AvailabilityDayRule[];
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  blockingBookings: BlockingBooking[];
  /**
   * Flat mode: max slots across the whole range.
   * `groupBy: 'day'`: max slots **per calendar day**.
   */
  limit: number;
  groupBy?: 'day';
};

export type AvailabilityDaySlots = {
  date: string;
  slots: AvailabilitySlot[];
};

export type GeneratedAvailability = {
  slots: AvailabilitySlot[];
  days?: AvailabilityDaySlots[];
};

/** Ch.8.3 — pad existing bookings by buffer on both sides for client-facing availability. */
export function padBlockingBookings(
  bookings: BlockingBooking[],
  bufferMinutes: number,
): BlockingBooking[] {
  if (bufferMinutes <= 0) {
    return bookings;
  }
  const padMs = bufferMinutes * 60_000;
  return bookings.map((booking) => ({
    startTime: new Date(booking.startTime.getTime() - padMs),
    endTime: new Date(booking.endTime.getTime() + padMs),
  }));
}

function candidateOverlaps(
  candidate: Date,
  slotEnd: Date,
  paddedBookings: BlockingBooking[],
): boolean {
  return paddedBookings.some((booking) =>
    intervalsOverlap(candidate, slotEnd, booking.startTime, booking.endTime),
  );
}

export function generateAvailabilitySlots(input: GenerateAvailabilityInput): GeneratedAvailability {
  const now = input.now ?? new Date();
  const totalBlockMinutes = input.durationMinutes + input.bufferMinutes;
  const paddedBookings = padBlockingBookings(input.blockingBookings, input.bufferMinutes);
  const groupByDay = input.groupBy === 'day';
  const days: AvailabilityDaySlots[] = [];
  const slots: AvailabilitySlot[] = [];

  for (const day of input.dayRules) {
    if (day.isClosed) {
      continue;
    }

    const daySlots: AvailabilitySlot[] = [];

    for (const range of day.ranges) {
      const windowStart = wallClockToUtc(day.date, range.start, input.timeZone);
      const windowEnd = wallClockToUtc(day.date, range.end, input.timeZone);

      if (windowEnd <= windowStart) {
        continue;
      }

      for (
        let candidate = new Date(windowStart);
        candidate.getTime() + totalBlockMinutes * 60_000 <= windowEnd.getTime();
        candidate = new Date(candidate.getTime() + input.slotIntervalMinutes * 60_000)
      ) {
        if (candidate < input.from || candidate >= input.to || candidate < now) {
          continue;
        }

        const slotEnd = new Date(candidate.getTime() + totalBlockMinutes * 60_000);
        if (candidateOverlaps(candidate, slotEnd, paddedBookings)) {
          continue;
        }

        const slot: AvailabilitySlot = {
          startTime: candidate.toISOString(),
          endTime: slotEnd.toISOString(),
          durationMinutes: input.durationMinutes,
          bufferMinutes: input.bufferMinutes,
        };

        if (groupByDay) {
          daySlots.push(slot);
          if (daySlots.length >= input.limit) {
            break;
          }
        } else {
          slots.push(slot);
          if (slots.length >= input.limit) {
            return { slots };
          }
        }
      }

      if (groupByDay && daySlots.length >= input.limit) {
        break;
      }
    }

    if (groupByDay && daySlots.length > 0) {
      days.push({ date: day.date, slots: daySlots });
      slots.push(...daySlots);
    }
  }

  if (groupByDay) {
    return { slots, days };
  }

  return { slots };
}

export function slotMatchesAvailability(slots: AvailabilitySlot[], startTime: Date): boolean {
  const target = startTime.toISOString();
  return slots.some((slot) => slot.startTime === target);
}
