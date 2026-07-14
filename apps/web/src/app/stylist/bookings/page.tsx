'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type {
  Booking,
  CalendarConnectionStatus,
  SchedulingSettings,
} from '@project-braids/shared-types/api';
import { BookingCard } from '@/features/booking/booking-card';
import { ManualBookingForm } from '@/features/booking/manual-booking-form';
import { WeekCalendar } from '@/features/dashboard/week-calendar';
import { useStylistBookings } from '@/features/dashboard/use-stylist-bookings';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import {
  bookingDateKey,
  bookingOnDateKey,
  getMultiWeekRangeIso,
  getWeekDays,
  todayDateKey,
} from '@/shared/lib/week-dates';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';
import Link from 'next/link';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

export default function StylistBookingsPage() {
  const queryClient = useQueryClient();
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [showManualForm, setShowManualForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRange = getMultiWeekRangeIso(weekAnchor, 2);
  const initialFocusDone = useRef(false);

  const bookingsQuery = useStylistBookings({
    from: fetchRange.from,
    to: fetchRange.to,
  });

  const schedulingQuery = useQuery({
    queryKey: ['business', 'scheduling'],
    queryFn: () => apiFetchData<SchedulingSettings>('/businesses/me/scheduling'),
  });

  const calendarStatusQuery = useQuery({
    queryKey: ['business', 'calendar', 'status'],
    queryFn: () => apiFetchData<CalendarConnectionStatus>('/businesses/me/calendar/status'),
  });

  const approvalMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetchData<SchedulingSettings>('/businesses/me/scheduling', {
        method: 'PATCH',
        json: { requireStylistApproval: enabled },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'scheduling'] });
    },
  });

  const approveBookingMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetchData<Booking>(`/bookings/${bookingId}/approve`, { method: 'POST', json: {} }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const bookings = bookingsQuery.data ?? [];
  const pendingApproval = bookings.filter((b) => b.pendingStylistApproval);
  const dayBookings = bookings
    .filter((booking) => bookingOnDateKey(booking.startTime, selectedDateKey))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Jump to the nearest upcoming appointment when today has none (e.g. booking is tomorrow).
  useEffect(() => {
    if (bookingsQuery.isLoading || initialFocusDone.current) return;

    const active = bookings.filter((b) => b.status === 'held' || b.status === 'confirmed');
    if (active.length === 0) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const nearest = [...active]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .find((b) => new Date(b.startTime) >= startOfToday);
    if (!nearest) return;

    const nearestKey = bookingDateKey(nearest.startTime);
    const visibleKeys = new Set(getWeekDays(weekAnchor).map((day) => day.dateKey));
    const selectedHasBookings = bookings.some((b) =>
      bookingOnDateKey(b.startTime, selectedDateKey),
    );

    if (!selectedHasBookings || !visibleKeys.has(nearestKey)) {
      if (!visibleKeys.has(nearestKey)) {
        setWeekAnchor(new Date(nearest.startTime));
      }
      setSelectedDateKey(nearestKey);
    }

    initialFocusDone.current = true;
  }, [bookings, bookingsQuery.isLoading, selectedDateKey, weekAnchor]);

  async function toggleApproval() {
    setError(null);
    const next = !schedulingQuery.data?.requireStylistApproval;
    try {
      await approvalMutation.mutateAsync(next);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader title="Calendar" subtitle="Week view — tap a day to see appointments." />

      <div className="mt-4 space-y-3">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Google Calendar</p>
            <p className="text-xs text-ink-muted">
              {calendarStatusQuery.data?.connected ? 'Connected' : 'Not connected'}
            </p>
          </div>
          <Link href="/stylist/calendar" className={TOUCH_LINK_CLASS}>
            {calendarStatusQuery.data?.connected ? 'Manage sync' : 'Connect →'}
          </Link>
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Approve every booking</p>
            <p className="text-xs text-ink-muted">
              When on, AI holds need your approval before the client gets a deposit link.
            </p>
          </div>
          <Button
            variant={schedulingQuery.data?.requireStylistApproval ? 'primary' : 'secondary'}
            onClick={() => void toggleApproval()}
            disabled={approvalMutation.isPending || schedulingQuery.isLoading}
          >
            {schedulingQuery.data?.requireStylistApproval ? 'On' : 'Off'}
          </Button>
        </Card>

        <Button variant="secondary" onClick={() => setShowManualForm((open) => !open)}>
          {showManualForm ? 'Hide manual booking' : 'Block time manually'}
        </Button>
      </div>

      {showManualForm ? (
        <div className="mt-4">
          <ManualBookingForm onCreated={() => setShowManualForm(false)} />
        </div>
      ) : null}

      {pendingApproval.length > 0 ? (
        <section className="mt-6 space-y-3" aria-label="Pending approval">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warning">
            Awaiting your approval
          </h2>
          {pendingApproval.map((booking) => (
            <Card key={booking.id} className="space-y-3 border-warning/40">
              <BookingCard booking={booking} href={`/stylist/bookings/${booking.id}`} />
              <Button
                fullWidth
                onClick={() => void approveBookingMutation.mutateAsync(booking.id)}
                disabled={approveBookingMutation.isPending}
              >
                Approve & send deposit link
              </Button>
            </Card>
          ))}
        </section>
      ) : null}

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
              <div key={booking.id} className="space-y-1">
                <BookingCard booking={booking} href={`/stylist/bookings/${booking.id}`} />
                {booking.pendingStylistApproval ? (
                  <StatusBadge label="Pending approval" tone="warning" />
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </PageShell>
  );
}
