'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { Booking } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { BookingCard } from '@/features/booking/booking-card';
import { apiFetchData } from '@/shared/lib/api-client';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function ClientHomePage() {
  const auth = useAuth();

  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'client', 'upcoming'],
    queryFn: () => apiFetchData<Booking[]>('/bookings/mine?segment=upcoming'),
  });

  const upcoming = (bookingsQuery.data ?? []).slice(0, 2);

  return (
    <PageShell>
      <PageHeader
        title="Your bookings"
        subtitle="Clear price, clear time — book with confidence."
      />

      <div className="mt-6 space-y-4">
        <Card className="space-y-2 bg-primary-subtle border-primary/20">
          <p className="text-sm font-medium text-ink">Looking for a new stylist?</p>
          <p className="text-sm text-ink-muted">
            Browse the beta directory or open a booking link your stylist sent you.
          </p>
          <Link href="/directory" className={TOUCH_LINK_CLASS}>
            Find a braider →
          </Link>
        </Card>

        <Card className="space-y-2 bg-primary-subtle border-primary/20">
          <p className="text-sm font-medium text-ink">Have a booking link from your stylist?</p>
          <p className="text-sm text-ink-muted">
            Open the link they sent you, or paste the URL in your browser to book.
          </p>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Upcoming</h2>
            <Link href="/client/bookings" className={TOUCH_LINK_CLASS}>
              View all
            </Link>
          </div>
          {bookingsQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">No upcoming bookings.</p>
          ) : (
            upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                href={`/client/bookings/${booking.id}`}
                showStylist
              />
            ))
          )}
        </div>

        <Card className="space-y-2">
          <p className="text-sm font-medium text-ink">Profile & saved stylists</p>
          <p className="text-sm text-ink-muted">
            Optional display name, saved favourites, and notification preferences.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/client/profile" className={TOUCH_LINK_CLASS}>
              Profile →
            </Link>
            <Link href="/client/saved-stylists" className={TOUCH_LINK_CLASS}>
              Saved stylists →
            </Link>
          </div>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium text-ink">Messages (SMS)</p>
          <p className="text-sm text-ink-muted">
            Chat with stylists via text — the AI receptionist replies by SMS. Open a stylist
            profile and tap Text AI receptionist, then check Messages for the thread.
          </p>
          <Link href="/client/inbox" className={TOUCH_LINK_CLASS}>
            Open Messages →
          </Link>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium text-ink">Notifications</p>
          <p className="text-sm text-ink-muted">
            Manage appointment reminders and marketing messages.
          </p>
          <Link href="/client/notifications" className={TOUCH_LINK_CLASS}>
            Notification preferences →
          </Link>
        </Card>

        {auth.user ? (
          <p className="text-center text-xs text-ink-muted">Signed in as {auth.user.phoneNumber}</p>
        ) : null}

        <SignOutButton />
      </div>
    </PageShell>
  );
}
