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
  limit: number;
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

export function generateAvailabilitySlots(input: GenerateAvailabilityInput): AvailabilitySlot[] {
  const now = input.now ?? new Date();
  const totalBlockMinutes = input.durationMinutes + input.bufferMinutes;
  const paddedBookings = padBlockingBookings(input.blockingBookings, input.bufferMinutes);
  const slots: AvailabilitySlot[] = [];

  for (const day of input.dayRules) {
    if (day.isClosed) {
      continue;
    }

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
        const overlaps = paddedBookings.some((booking) =>
          intervalsOverlap(candidate, slotEnd, booking.startTime, booking.endTime),
        );

        if (!overlaps) {
          slots.push({
            startTime: candidate.toISOString(),
            endTime: slotEnd.toISOString(),
            durationMinutes: input.durationMinutes,
            bufferMinutes: input.bufferMinutes,
          });
        }

        if (slots.length >= input.limit) {
          return slots;
        }
      }
    }
  }

  return slots;
}

export function slotMatchesAvailability(slots: AvailabilitySlot[], startTime: Date): boolean {
  const target = startTime.toISOString();
  return slots.some((slot) => slot.startTime === target);
}
