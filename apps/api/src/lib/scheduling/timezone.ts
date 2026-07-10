import type { Weekday } from '@project-braids/shared-types/api';

const WEEKDAY_NAMES: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return { year, month, day };
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const parts = hhmm.split(':');
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid time: ${hhmm}`);
  }
  return { hour, minute };
}

export function getDateKeyInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function getWeekdayInTimeZone(instant: Date, timeZone: string): Weekday {
  const weekdayIndex = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
  })
    .formatToParts(instant)
    .find((part) => part.type === 'weekday')?.value;

  const map: Record<string, Weekday> = {
    Sun: 'sunday',
    Mon: 'monday',
    Tue: 'tuesday',
    Wed: 'wednesday',
    Thu: 'thursday',
    Fri: 'friday',
    Sat: 'saturday',
  };

  return map[weekdayIndex ?? 'Mon'] ?? 'monday';
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function wallClockToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const { hour, minute } = parseTime(hhmm);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let corrected = utcGuess;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(corrected).map((part) => [part.type, part.value]),
    );
    const displayed = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    corrected = new Date(corrected.getTime() + (desired - displayed));
  }

  return corrected;
}

export function eachDateKeyInclusive(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  while (cursor <= toKey) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return keys;
}

export function weekdayFromDateKey(dateKey: string): Weekday {
  const { year, month, day } = parseDateKey(dateKey);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_NAMES[weekdayIndex] ?? 'monday';
}
