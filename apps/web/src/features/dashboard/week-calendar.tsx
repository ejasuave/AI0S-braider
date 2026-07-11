'use client';

import type { Booking } from '@project-braids/shared-types/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  bookingOnDateKey,
  getWeekDays,
  shiftWeekAnchor,
  type WeekDay,
} from '@/shared/lib/week-dates';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

type WeekCalendarProps = {
  bookings: Booking[];
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  weekAnchor?: Date;
  onWeekAnchorChange?: (anchor: Date) => void;
};

export function WeekCalendar({
  bookings,
  selectedDateKey,
  onSelectDateKey,
  weekAnchor = new Date(),
  onWeekAnchorChange,
}: WeekCalendarProps) {
  const days = getWeekDays(weekAnchor);
  const weekLabel = formatWeekRangeLabel(days);

  return (
    <div className="space-y-2">
      {onWeekAnchorChange ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            aria-label="Previous week"
            onClick={() => onWeekAnchorChange(shiftWeekAnchor(weekAnchor, -1))}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <p className="text-sm font-medium text-ink">{weekLabel}</p>
          <Button
            type="button"
            variant="ghost"
            aria-label="Next week"
            onClick={() => onWeekAnchorChange(shiftWeekAnchor(weekAnchor, 1))}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" role="tablist" aria-label="Week calendar">
        {days.map((day) => (
          <DayPill
            key={day.dateKey}
            day={day}
            count={bookings.filter((b) => bookingOnDateKey(b.startTime, day.dateKey)).length}
            selected={selectedDateKey === day.dateKey}
            onSelect={() => onSelectDateKey(day.dateKey)}
          />
        ))}
      </div>
    </div>
  );
}

function formatWeekRangeLabel(days: WeekDay[]): string {
  const first = days[0];
  const last = days[6];
  if (!first || !last) return 'This week';

  const start = new Date(`${first.dateKey}T12:00:00`);
  const end = new Date(`${last.dateKey}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();

  const startLabel = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  });
  const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${startLabel} – ${endLabel}`;
}

function DayPill({
  day,
  count,
  selected,
  onSelect,
}: {
  day: WeekDay;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 flex-col items-center justify-center rounded-md border px-0.5 py-2 text-center transition-colors sm:px-1',
        selected
          ? 'border-primary bg-primary-subtle text-ink'
          : 'border-border bg-surface text-ink-muted active:bg-surface-raised',
        day.isToday && !selected && 'border-primary/40',
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide sm:hidden">
        {day.weekdayInitial}
      </span>
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide sm:inline">
        {day.weekdayLabel}
      </span>
      <span className="text-sm font-semibold text-ink">{day.dayLabel}</span>
      {count > 0 ? (
        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      ) : (
        <span className="mt-0.5 h-1.5 w-1.5" aria-hidden />
      )}
      <span className="sr-only">
        {count} booking{count === 1 ? '' : 's'}
        {day.isToday ? ', today' : ''}
      </span>
    </button>
  );
}
