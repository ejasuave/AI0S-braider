'use client';

import { useQuery } from '@tanstack/react-query';
import type { Booking } from '@project-braids/shared-types/api';
import { BookingCard } from '@/features/booking/booking-card';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData } from '@/shared/lib/api-client';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function ClientBookingsPage() {
  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'client'],
    queryFn: () => apiFetchData<Booking[]>('/bookings/mine'),
  });

  const bookings = bookingsQuery.data ?? [];

  return (
    <PageShell>
      <PageHeader title="Bookings" subtitle="Your appointments and deposit status." />

      <div className="mt-6 space-y-3">
        {bookingsQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="Use the link your stylist shared to book your first appointment."
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

      <div className="mt-8">
        <SignOutButton />
      </div>
    </PageShell>
  );
}
