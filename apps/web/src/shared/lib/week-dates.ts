export type WeekDay = {
  dateKey: string;
  weekdayLabel: string;
  weekdayInitial: string;
  dayLabel: string;
  isToday: boolean;
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey(): string {
  return formatDateKey(new Date());
}

export function getWeekDays(anchor = new Date()): WeekDay[] {
  const todayKey = formatDateKey(anchor);
  const monday = new Date(anchor);
  monday.setHours(12, 0, 0, 0);
  const dayOfWeek = monday.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = formatDateKey(date);

    const weekdayLabel = date.toLocaleDateString('en-GB', { weekday: 'short' });

    return {
      dateKey,
      weekdayLabel,
      weekdayInitial: weekdayLabel.charAt(0),
      dayLabel: String(date.getDate()),
      isToday: dateKey === todayKey,
    };
  });
}

export function getDayRangeIso(dateKey: string): { from: string; to: string } {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const from = new Date(year, month - 1, day, 0, 0, 0, 0);
  const to = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function getWeekRangeIso(anchor = new Date()): { from: string; to: string } {
  const days = getWeekDays(anchor);
  const { from } = getDayRangeIso(days[0]!.dateKey);
  const { to } = getDayRangeIso(days[6]!.dateKey);
  return { from, to };
}

/** Fetch window covering the visible week plus following weeks (for bookings just over week boundary). */
export function getMultiWeekRangeIso(
  anchor = new Date(),
  weekCount = 2,
): { from: string; to: string } {
  const { from } = getWeekRangeIso(anchor);
  const lastWeekAnchor = shiftWeekAnchor(anchor, weekCount - 1);
  const { to } = getWeekRangeIso(lastWeekAnchor);
  return { from, to };
}

export function bookingDateKey(startTimeIso: string): string {
  return formatDateKey(new Date(startTimeIso));
}

export function bookingOnDateKey(startTimeIso: string, dateKey: string): boolean {
  return bookingDateKey(startTimeIso) === dateKey;
}

export function shiftWeekAnchor(anchor: Date, weeks: number): Date {
  const next = new Date(anchor);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}
