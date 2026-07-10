import type { AvailabilitySlot } from '@project-braids/shared-types/api';
import type { Weekday } from '@project-braids/shared-types/api';
import { intervalsOverlap } from './conflict.js';
import {
  eachDateKeyInclusive,
  getDateKeyInTimeZone,
  wallClockToUtc,
  weekdayFromDateKey,
} from '../../lib/scheduling/timezone.js';

type WorkingDay = {
  enabled: boolean;
  start: string;
  end: string;
};

type WorkingHours = Partial<Record<Weekday, WorkingDay>>;

type BlockingBooking = {
  startTime: Date;
  endTime: Date;
};

export type GenerateAvailabilityInput = {
  from: Date;
  to: Date;
  now?: Date;
  timeZone: string;
  workingHours: WorkingHours;
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  blockingBookings: BlockingBooking[];
  limit: number;
};

export function generateAvailabilitySlots(input: GenerateAvailabilityInput): AvailabilitySlot[] {
  const now = input.now ?? new Date();
  const fromKey = getDateKeyInTimeZone(input.from, input.timeZone);
  const toKey = getDateKeyInTimeZone(input.to, input.timeZone);
  const totalBlockMinutes = input.durationMinutes + input.bufferMinutes;
  const slots: AvailabilitySlot[] = [];

  for (const dateKey of eachDateKeyInclusive(fromKey, toKey)) {
    const weekday = weekdayFromDateKey(dateKey);
    const day = input.workingHours[weekday];
    if (!day?.enabled) {
      continue;
    }

    const windowStart = wallClockToUtc(dateKey, day.start, input.timeZone);
    const windowEnd = wallClockToUtc(dateKey, day.end, input.timeZone);

    if (windowEnd <= windowStart) {
      continue;
    }

    for (
      let candidate = new Date(windowStart);
      candidate.getTime() + totalBlockMinutes * 60_000 <= windowEnd.getTime();
      candidate = new Date(candidate.getTime() + input.slotIntervalMinutes * 60_000)
    ) {
      if (candidate < now) {
        continue;
      }

      const slotEnd = new Date(candidate.getTime() + totalBlockMinutes * 60_000);
      const overlaps = input.blockingBookings.some((booking) =>
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

  return slots;
}

export function slotMatchesAvailability(
  slots: AvailabilitySlot[],
  startTime: Date,
): boolean {
  const target = startTime.toISOString();
  return slots.some((slot) => slot.startTime === target);
}
