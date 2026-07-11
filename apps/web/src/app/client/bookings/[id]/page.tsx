'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { Booking, BookingActionResult, Payment } from '@project-braids/shared-types/api';
import { apiFetchData, ApiClientError, getApiErrorMessage } from '@/shared/lib/api-client';
import {
  bookingStatusLabel,
  bookingStatusTone,
  depositStatusLabel,
  formatDateTime,
  formatMoney,
  paymentStatusLabel,
} from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

export default function ClientBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ['bookings', 'client', params.id],
    queryFn: () => apiFetchData<Booking>(`/bookings/mine/${params.id}`),
  });

  const paymentQuery = useQuery({
    queryKey: ['payments', 'deposit', params.id],
    queryFn: async () => {
      try {
        return await apiFetchData<Payment>(`/payments/deposits/${params.id}`);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(bookingQuery.data),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetchData<BookingActionResult>(`/bookings/mine/${params.id}/cancel`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'client', params.id] });
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'client'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const existing = paymentQuery.data;
      if (existing && existing.status === 'pending') {
        return existing;
      }
      return apiFetchData<Payment>('/payments/deposits', {
        method: 'POST',
        json: { bookingId: params.id },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments', 'deposit', params.id] });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: () =>
      apiFetchData<Payment>(`/payments/deposits/${params.id}/simulate-success`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments', 'deposit', params.id] });
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'client', params.id] });
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'client'] });
    },
  });

  const booking = bookingQuery.data;
  const payment = paymentQuery.data;
  const error =
    payMutation.error || simulateMutation.error || cancelMutation.error
      ? getApiErrorMessage(payMutation.error ?? simulateMutation.error ?? cancelMutation.error)
      : null;

  const needsDeposit = booking?.status === 'held' && booking.depositStatus === 'pending';

  return (
    <PageShell>
      <PageHeader title="Booking" backHref="/client/bookings" />

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
                <dt className="text-ink-muted">Total price</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.agreedPrice)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Deposit due</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.depositAmount)}</dd>
              </div>
              {booking.holdExpiresAt ? (
                <div>
                  <dt className="text-ink-muted">Hold expires</dt>
                  <dd className="font-medium text-warning">
                    {formatDateTime(booking.holdExpiresAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {payment ? (
            <Card className="space-y-2">
              <p className="text-sm font-medium text-ink">Payment</p>
              <StatusBadge label={paymentStatusLabel(payment.status)} tone="neutral" />
              <p className="text-sm text-ink-muted">
                {formatMoney(payment.amount, payment.currency.toUpperCase())}
              </p>
            </Card>
          ) : null}

          {error ? <p className="text-sm text-error">{error}</p> : null}

          {needsDeposit ? (
            <div className="space-y-2">
              <Button
                fullWidth
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
              >
                {payMutation.isPending ? 'Preparing payment…' : 'Pay deposit'}
              </Button>
              {process.env.NODE_ENV !== 'production' ? (
                <>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => simulateMutation.mutate()}
                    disabled={simulateMutation.isPending}
                  >
                    {simulateMutation.isPending ? 'Simulating…' : 'Dev: simulate deposit paid'}
                  </Button>
                  <p className="text-xs text-ink-muted">
                    Requires mock Stripe (leave <code>STRIPE_SECRET_KEY</code> unset in API{' '}
                    <code>.env</code>).
                  </p>
                </>
              ) : null}
            </div>
          ) : booking.depositStatus === 'paid' && booking.status === 'held' ? (
            <Card className="bg-success/5">
              <p className="text-sm text-success">
                Deposit paid — waiting for your stylist to confirm the booking.
              </p>
            </Card>
          ) : booking.status === 'confirmed' ? (
            <Card className="bg-success/5">
              <p className="text-sm text-success">Booking confirmed. See you soon!</p>
            </Card>
          ) : null}

          {booking.status === 'held' || booking.status === 'confirmed' ? (
            <Button
              variant="danger"
              fullWidth
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-error">Booking not found.</p>
      )}
    </PageShell>
  );
}
