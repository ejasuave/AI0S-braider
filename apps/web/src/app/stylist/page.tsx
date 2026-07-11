'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ConnectStatusResponse, StylistProfile } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { BookingCard } from '@/features/booking/booking-card';
import { useEscalationCount } from '@/features/dashboard/use-escalation-count';
import { useStylistBookings } from '@/features/dashboard/use-stylist-bookings';
import { apiFetchData } from '@/shared/lib/api-client';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { bookingOnDateKey, getDayRangeIso, todayDateKey } from '@/shared/lib/week-dates';
import { Card } from '@/shared/ui/card';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

export default function StylistDashboardPage() {
  const auth = useAuth();
  const escalatedCountQuery = useEscalationCount();
  const escalatedCount = escalatedCountQuery.data ?? 0;

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiFetchData<StylistProfile>('/profile/me'),
  });

  const todayRange = getDayRangeIso(todayDateKey());
  const todayBookingsQuery = useStylistBookings({
    from: todayRange.from,
    to: todayRange.to,
  });

  const connectQuery = useQuery({
    queryKey: ['payments', 'connect'],
    queryFn: () => apiFetchData<ConnectStatusResponse>('/payments/connect/status'),
  });

  const todayBookings = (todayBookingsQuery.data ?? [])
    .filter((b) => b.status === 'held' || b.status === 'confirmed')
    .filter((b) => bookingOnDateKey(b.startTime, todayDateKey()))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const businessName = profileQuery.data?.businessName ?? 'Your business';

  return (
    <PageShell>
      <PageHeader title={businessName} subtitle="Your business finally has a front desk." />

      <div className="mt-6 space-y-4" aria-live="polite" aria-atomic="false">
        {escalatedCount > 0 ? (
          <Card className="space-y-3 border-warning/40 bg-warning/5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-ink">Needs your reply</h2>
              <StatusBadge label={`${escalatedCount} escalated`} tone="warning" />
            </div>
            <p className="text-sm text-ink-muted">
              Clients are waiting on you — the AI has handed these conversations over.
            </p>
            <Link href="/stylist/inbox" className={TOUCH_LINK_CLASS}>
              Open inbox →
            </Link>
          </Card>
        ) : (
          <Card className="space-y-2">
            <h2 className="font-medium text-ink">Inbox</h2>
            <p className="text-sm text-ink-muted">No escalations — AI is handling client texts.</p>
            <Link href="/stylist/inbox" className={TOUCH_LINK_CLASS}>
              View conversations →
            </Link>
          </Card>
        )}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Today</h2>
            <Link href="/stylist/bookings" className={TOUCH_LINK_CLASS}>
              Calendar
            </Link>
          </div>
          {todayBookingsQuery.isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : todayBookings.length === 0 ? (
            <p className="text-sm text-ink-muted">No appointments today.</p>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  href={`/stylist/bookings/${booking.id}`}
                />
              ))}
            </div>
          )}
        </Card>

        {!connectQuery.data?.onboardingComplete ? (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-ink">Payments</h2>
              <StatusBadge label="Setup required" tone="warning" />
            </div>
            <Link href="/stylist/payments" className={TOUCH_LINK_CLASS}>
              Connect Stripe to accept deposits →
            </Link>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/stylist/services" className="block min-h-14 active:opacity-90">
            <Card className="flex h-full min-h-14 items-center justify-center text-center">
              <div>
                <p className="font-medium text-ink">Services</p>
                <p className="mt-1 text-xs text-ink-muted">Manage pricing</p>
              </div>
            </Card>
          </Link>
          <Link href="/stylist/profile" className="block min-h-14 active:opacity-90">
            <Card className="flex h-full min-h-14 items-center justify-center text-center">
              <div>
                <p className="font-medium text-ink">Profile</p>
                <p className="mt-1 text-xs text-ink-muted">Business details</p>
              </div>
            </Card>
          </Link>
        </div>

        {auth.user ? (
          <p className="text-center text-xs text-ink-muted">
            Signed in as {auth.user.email ?? auth.user.phoneNumber}
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}
