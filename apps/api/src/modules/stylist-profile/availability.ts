import { randomUUID } from 'node:crypto';
import type { Weekday } from '@project-braids/shared-types/api';
import { DEFAULT_WORKING_HOURS } from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { WEEKDAY_NAME_TO_INDEX } from './mappers.js';

export type AvailabilityDayRule = {
  date: string;
  isClosed: boolean;
  ranges: Array<{ start: string; end: string }>;
};

export type BaseAvailabilityRules = {
  businessId: string;
  from: string;
  to: string;
  days: AvailabilityDayRule[];
};

function eachDateKeyInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function weekdayIndexFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}

/**
 * Ch.6.6 — merged working_hours + schedule_exceptions for Ch.8 consumption.
 */
export async function getBaseAvailabilityRules(
  businessId: string,
  from: string,
  to: string,
): Promise<BaseAvailabilityRules> {
  const [workingHours, exceptions] = await Promise.all([
    prisma.workingHour.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.scheduleException.findMany({
      where: {
        businessId,
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
    }),
  ]);

  const exceptionByDate = new Map(
    exceptions.map((row) => [row.date.toISOString().slice(0, 10), row]),
  );

  const hoursByDay = new Map<number, Array<{ start: string; end: string }>>();
  for (const row of workingHours) {
    const list = hoursByDay.get(row.dayOfWeek) ?? [];
    list.push({ start: row.startTime, end: row.endTime });
    hoursByDay.set(row.dayOfWeek, list);
  }

  const days = eachDateKeyInclusive(from, to).map((dateKey) => {
    const exception = exceptionByDate.get(dateKey);
    if (exception?.isClosed) {
      return { date: dateKey, isClosed: true, ranges: [] };
    }
    if (exception?.overrideStartTime && exception.overrideEndTime) {
      return {
        date: dateKey,
        isClosed: false,
        ranges: [{ start: exception.overrideStartTime, end: exception.overrideEndTime }],
      };
    }

    const weekday = weekdayIndexFromDateKey(dateKey);
    const ranges = hoursByDay.get(weekday) ?? [];
    return {
      date: dateKey,
      isClosed: ranges.length === 0,
      ranges,
    };
  });

  return { businessId, from, to, days };
}

/** Convert normalized rules to legacy weekday JSON for booking module compat. */
export function baseRulesToLegacyWorkingHours(
  rules: BaseAvailabilityRules,
): Partial<Record<Weekday, { enabled: boolean; start: string; end: string }>> {
  const result: Partial<Record<Weekday, { enabled: boolean; start: string; end: string }>> = {};
  const weekdayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;

  for (const name of weekdayNames) {
    const sample = rules.days.find(
      (day) => weekdayIndexFromDateKey(day.date) === weekdayNames.indexOf(name),
    );
    if (!sample || sample.isClosed || sample.ranges.length === 0) {
      result[name] = { enabled: false, start: '09:00', end: '17:00' };
      continue;
    }
    result[name] = {
      enabled: true,
      start: sample.ranges[0]!.start,
      end: sample.ranges[0]!.end,
    };
  }

  return result;
}

export type LegacyWorkingHours = Record<string, { enabled: boolean; start: string; end: string }>;

export function legacyWorkingHoursToRows(
  hours: LegacyWorkingHours,
): Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> {
  return Object.entries(hours).flatMap(([weekday, day]) => {
    if (!day.enabled) {
      return [];
    }
    const dayOfWeek = WEEKDAY_NAME_TO_INDEX[weekday];
    if (dayOfWeek === undefined) {
      return [];
    }
    return [{ dayOfWeek, startTime: day.start, endTime: day.end, isActive: true }];
  });
}

/** Seed Ch.8 `working_hours` when a business is first linked (profile JSON alone is not enough). */
export async function ensureDefaultWorkingHoursForBusiness(businessId: string): Promise<void> {
  const count = await prisma.workingHour.count({ where: { businessId } });
  if (count > 0) {
    return;
  }

  const rows = legacyWorkingHoursToRows(DEFAULT_WORKING_HOURS).map((row) => ({
    id: randomUUID(),
    businessId,
    ...row,
  }));

  if (rows.length > 0) {
    await prisma.workingHour.createMany({ data: rows });
  }
}

export function validateWorkingHourRows(
  rows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): void {
  const byDay = new Map<number, Array<{ start: string; end: string }>>();

  for (const row of rows) {
    if (row.startTime >= row.endTime) {
      throw new Error(`startTime must be before endTime for day ${row.dayOfWeek}`);
    }
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push({ start: row.startTime, end: row.endTime });
    byDay.set(row.dayOfWeek, list);
  }

  for (const [day, ranges] of byDay) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i - 1]!.end > sorted[i]!.start) {
        throw new Error(`Overlapping working hours on day ${day}`);
      }
    }
  }
}
