'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { Booking } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import {
  bookingStatusLabel,
  bookingStatusTone,
  depositStatusLabel,
  formatDateTime,
  formatMoney,
} from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

export default function StylistBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ['bookings', 'stylist', params.id],
    queryFn: () => apiFetchData<Booking>(`/bookings/${params.id}`),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: 'confirm' | 'cancel' | 'complete' | 'no-show') => {
      const path =
        action === 'confirm'
          ? `/bookings/${params.id}/confirm`
          : action === 'cancel'
            ? `/bookings/${params.id}/cancel`
            : action === 'complete'
              ? `/bookings/${params.id}/complete`
              : `/bookings/${params.id}/no-show`;
      if (action === 'cancel' || action === 'no-show') {
        return apiFetchData<{ booking: Booking }>(path, {
          method: 'POST',
          json: action === 'cancel' ? {} : undefined,
        });
      }
      return apiFetchData<Booking>(path, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const booking = bookingQuery.data;
  const error = actionMutation.error ? getApiErrorMessage(actionMutation.error) : null;

  return (
    <PageShell>
      <PageHeader title="Booking" backHref="/stylist/bookings" />

      {bookingQuery.isLoading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : booking ? (
        <div className="mt-6 space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={bookingStatusLabel(booking.status)}
                tone={bookingStatusTone(booking.status)}
              />
              <StatusBadge label={depositStatusLabel(booking.depositStatus)} tone="neutral" />
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-ink-muted">When</dt>
                <dd className="font-medium text-ink">{formatDateTime(booking.startTime)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Price</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.agreedPrice)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Deposit</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.depositAmount)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Duration</dt>
                <dd className="font-medium text-ink">{booking.agreedDurationMinutes} minutes</dd>
              </div>
            </dl>
          </Card>

          {error ? <p className="text-sm text-error">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {booking.status === 'held' && booking.depositStatus === 'paid' ? (
              <Button
                fullWidth
                className="sm:w-auto"
                onClick={() => actionMutation.mutate('confirm')}
                disabled={actionMutation.isPending}
              >
                Confirm booking
              </Button>
            ) : null}
            {booking.status === 'confirmed' ? (
              <>
                <Button
                  fullWidth
                  className="sm:w-auto"
                  onClick={() => actionMutation.mutate('complete')}
                  disabled={actionMutation.isPending}
                >
                  Mark completed
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  className="sm:w-auto"
                  onClick={() => actionMutation.mutate('no-show')}
                  disabled={actionMutation.isPending}
                >
                  No show
                </Button>
              </>
            ) : null}
            {booking.status === 'held' || booking.status === 'confirmed' ? (
              <Button
                variant="danger"
                fullWidth
                className="sm:w-auto"
                onClick={() => actionMutation.mutate('cancel')}
                disabled={actionMutation.isPending}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-error">Booking not found.</p>
      )}
    </PageShell>
  );
}
