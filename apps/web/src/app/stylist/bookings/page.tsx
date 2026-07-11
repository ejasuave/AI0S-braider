'use client';

import { useState } from 'react';
import { BookingCard } from '@/features/booking/booking-card';
import { WeekCalendar } from '@/features/dashboard/week-calendar';
import { useStylistBookings } from '@/features/dashboard/use-stylist-bookings';
import { bookingOnDateKey, getWeekRangeIso, todayDateKey } from '@/shared/lib/week-dates';
import { EmptyState } from '@/shared/ui/empty-state';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StylistBookingsPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const weekRange = getWeekRangeIso(weekAnchor);

  const bookingsQuery = useStylistBookings({
    from: weekRange.from,
    to: weekRange.to,
  });

  const bookings = bookingsQuery.data ?? [];
  const dayBookings = bookings
    .filter((booking) => bookingOnDateKey(booking.startTime, selectedDateKey))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <PageShell>
      <PageHeader title="Calendar" subtitle="Week view — tap a day to see appointments." />

      <div className="mt-6 space-y-4">
        <WeekCalendar
          bookings={bookings}
          selectedDateKey={selectedDateKey}
          onSelectDateKey={setSelectedDateKey}
          weekAnchor={weekAnchor}
          onWeekAnchorChange={setWeekAnchor}
        />

        <section className="space-y-3" aria-label="Bookings for selected day">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {selectedDateKey === todayDateKey() ? "Today's appointments" : 'Appointments'}
          </h2>

          {bookingsQuery.isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : dayBookings.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              description="No bookings on this day. Share your link or wait for the AI receptionist."
              action={{ label: 'Manage services', href: '/stylist/services' }}
            />
          ) : (
            dayBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                href={`/stylist/bookings/${booking.id}`}
              />
            ))
          )}
        </section>
      </div>
    </PageShell>
  );
}
