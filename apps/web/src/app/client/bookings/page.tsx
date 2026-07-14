'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Booking, ClientBookingSegment } from '@project-braids/shared-types/api';
import { BookingCard } from '@/features/booking/booking-card';
import { apiFetchData } from '@/shared/lib/api-client';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { cn } from '@/shared/lib/cn';

const SEGMENTS: { id: ClientBookingSegment; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function ClientBookingsPage() {
  const [segment, setSegment] = useState<ClientBookingSegment>('upcoming');

  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'client', segment],
    queryFn: () => apiFetchData<Booking[]>(`/bookings/mine?segment=${segment}`),
  });

  const bookings = bookingsQuery.data ?? [];

  return (
    <PageShell>
      <PageHeader title="Bookings" subtitle="Your appointments and deposit status." />

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Booking filters">
        {SEGMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={segment === item.id}
            onClick={() => setSegment(item.id)}
            className={cn(
              'min-h-11 rounded-md border px-3 text-sm font-medium',
              segment === item.id
                ? 'border-primary bg-primary-subtle text-ink'
                : 'border-border text-ink-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {bookingsQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No bookings in this view"
            description={
              segment === 'upcoming'
                ? 'Use the link your stylist shared to book your first appointment.'
                : 'Nothing to show for this filter.'
            }
          />
        ) : (
          bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              href={`/client/bookings/${booking.id}`}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
