'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Booking,
  BookingActionResult,
  DepositPaymentResponse,
  Payment,
  SyncDepositResponse,
} from '@project-braids/shared-types/api';
import {
  DepositCheckout,
  incompatibleMockClientSecretMessage,
  isIncompatibleMockClientSecret,
  isStripeCheckoutEnabled,
} from '@/features/payments/deposit-checkout';
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

const POLL_INTERVAL_MS = 2000;

function ClientBookingDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const stripeCheckoutEnabled = isStripeCheckoutEnabled();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(
    searchParams.get('deposit') === 'return',
  );
  const returnSyncStarted = useRef(false);

  const invalidateBookingQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'client', params.id] });
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'client'] });
    void queryClient.invalidateQueries({ queryKey: ['payments', 'deposit', params.id] });
  }, [params.id, queryClient]);

  const applySyncResult = useCallback(
    (result: SyncDepositResponse) => {
      if (result.bookingConfirmed) {
        setAwaitingConfirmation(false);
        setClientSecret(null);
        setCheckoutError(null);
      } else {
        setCheckoutError(
          'Payment received but your booking hold had expired — contact your stylist if a refund is pending.',
        );
      }
      invalidateBookingQueries();
    },
    [invalidateBookingQueries],
  );

  const syncDepositMutation = useMutation({
    mutationFn: () =>
      apiFetchData<SyncDepositResponse>(`/payments/deposits/${params.id}/sync`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: applySyncResult,
  });

  const bookingQuery = useQuery({
    queryKey: ['bookings', 'client', params.id],
    queryFn: () => apiFetchData<Booking>(`/bookings/mine/${params.id}`),
    refetchInterval: awaitingConfirmation ? POLL_INTERVAL_MS : false,
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

  useEffect(() => {
    if (
      paymentQuery.data?.clientSecret &&
      paymentQuery.data.status === 'pending' &&
      !isIncompatibleMockClientSecret(paymentQuery.data.clientSecret)
    ) {
      setClientSecret(paymentQuery.data.clientSecret);
    }
    if (
      paymentQuery.data?.clientSecret &&
      isIncompatibleMockClientSecret(paymentQuery.data.clientSecret)
    ) {
      setClientSecret(null);
      setCheckoutError(incompatibleMockClientSecretMessage());
    }
  }, [paymentQuery.data]);

  useEffect(() => {
    if (bookingQuery.data?.status === 'confirmed' || bookingQuery.data?.depositStatus === 'paid') {
      setAwaitingConfirmation(false);
      setClientSecret(null);
    }
  }, [bookingQuery.data?.depositStatus, bookingQuery.data?.status]);

  useEffect(() => {
    if (searchParams.get('deposit') !== 'return') return;
    if (returnSyncStarted.current) return;
    if (!bookingQuery.data || bookingQuery.data.depositStatus === 'paid') return;

    returnSyncStarted.current = true;
    setAwaitingConfirmation(true);
    syncDepositMutation.mutate(undefined, {
      onError: (err) => {
        if (err instanceof ApiClientError && err.status === 409) {
          return;
        }
        setCheckoutError(getApiErrorMessage(err, 'Could not confirm your deposit yet.'));
      },
    });
  }, [bookingQuery.data, searchParams, syncDepositMutation]);

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

  const prepareCheckoutMutation = useMutation({
    mutationFn: () =>
      apiFetchData<DepositPaymentResponse>('/payments/deposits', {
        method: 'POST',
        json: { bookingId: params.id },
      }),
    onSuccess: (data) => {
      setCheckoutError(null);
      if (isIncompatibleMockClientSecret(data.clientSecret)) {
        setClientSecret(null);
        setCheckoutError(incompatibleMockClientSecretMessage());
        return;
      }
      setClientSecret(data.clientSecret);
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

  const handlePaymentComplete = useCallback(async () => {
    setCheckoutError(null);
    setAwaitingConfirmation(true);
    try {
      const result = await syncDepositMutation.mutateAsync();
      applySyncResult(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        invalidateBookingQueries();
        return;
      }
      setCheckoutError(
        getApiErrorMessage(err, 'Payment succeeded but confirmation failed. Retrying…'),
      );
      invalidateBookingQueries();
    }
  }, [applySyncResult, invalidateBookingQueries, syncDepositMutation]);

  const booking = bookingQuery.data;
  const payment = paymentQuery.data;
  const needsDeposit = booking?.status === 'held' && booking.depositStatus === 'pending';
  const showMockSimulate = !stripeCheckoutEnabled && process.env.NODE_ENV !== 'production';

  const error =
    prepareCheckoutMutation.error ||
    simulateMutation.error ||
    cancelMutation.error ||
    syncDepositMutation.error
      ? getApiErrorMessage(
          prepareCheckoutMutation.error ??
            simulateMutation.error ??
            cancelMutation.error ??
            syncDepositMutation.error,
        )
      : checkoutError;

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

          {awaitingConfirmation && needsDeposit ? (
            <Card className="bg-primary-subtle border-primary/20">
              <p className="text-sm text-ink">Payment received — confirming your booking…</p>
            </Card>
          ) : null}

          {error ? <p className="text-sm text-error">{error}</p> : null}

          {needsDeposit &&
          clientSecret &&
          stripeCheckoutEnabled &&
          !isIncompatibleMockClientSecret(clientSecret) ? (
            <DepositCheckout
              clientSecret={clientSecret}
              bookingId={params.id}
              amountLabel={formatMoney(booking.depositAmount)}
              onPaid={handlePaymentComplete}
              onError={setCheckoutError}
            />
          ) : null}

          {needsDeposit && !clientSecret ? (
            <div className="space-y-2">
              {stripeCheckoutEnabled ? (
                <Button
                  fullWidth
                  onClick={() => prepareCheckoutMutation.mutate()}
                  disabled={prepareCheckoutMutation.isPending}
                >
                  {prepareCheckoutMutation.isPending ? 'Preparing payment…' : 'Continue to payment'}
                </Button>
              ) : null}

              {showMockSimulate ? (
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
                    Mock mode: leave <code>STRIPE_SECRET_KEY</code> unset in the API and omit{' '}
                    <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> on web.
                  </p>
                </>
              ) : null}

              {stripeCheckoutEnabled && !showMockSimulate ? (
                <p className="text-xs text-ink-muted">
                  You will enter card details on the next step. Deposits go directly to your stylist
                  via Stripe Connect.
                </p>
              ) : null}
            </div>
          ) : null}

          {booking.depositStatus === 'paid' && booking.status === 'held' ? (
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

export default function ClientBookingDetailPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="mt-6 text-sm text-ink-muted">Loading…</p>
        </PageShell>
      }
    >
      <ClientBookingDetailContent />
    </Suspense>
  );
}
