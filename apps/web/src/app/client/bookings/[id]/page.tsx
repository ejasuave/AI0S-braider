'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Booking,
  BookingActionResult,
  DepositPaymentResponse,
  Payment,
  SyncBalanceResponse,
  SyncDepositResponse,
} from '@project-braids/shared-types/api';
import { BookingMoneySummary } from '@/features/bookings/money-summary';
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
import { formatDurationLabel } from '@project-braids/shared-types/api';
import { serviceVenueModeLabel } from '@/shared/lib/venue';
import {
  remainingBalanceAllowsOnlineCard,
  remainingBalanceMethodLabel,
} from '@/shared/lib/pricing';
import { serviceBookingPath, stylistBookingPath } from '@/shared/lib/booking-links';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';
import Link from 'next/link';
import { SaveStylistButton } from '@/features/client/save-stylist-button';

const POLL_INTERVAL_MS = 2000;

function ClientBookingDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const stripeCheckoutEnabled = isStripeCheckoutEnabled();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [balanceClientSecret, setBalanceClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(
    searchParams.get('deposit') === 'return',
  );
  const [awaitingBalance, setAwaitingBalance] = useState(searchParams.get('balance') === 'return');
  const returnSyncStarted = useRef(false);
  const balanceReturnSyncStarted = useRef(false);

  const invalidateBookingQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'client', params.id] });
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'client'] });
    void queryClient.invalidateQueries({ queryKey: ['payments', 'deposit', params.id] });
    void queryClient.invalidateQueries({ queryKey: ['payments', 'balance', params.id] });
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

  const syncBalanceMutation = useMutation({
    mutationFn: () =>
      apiFetchData<SyncBalanceResponse>(`/payments/balances/${params.id}/sync`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: (result) => {
      if (result.balancePaid) {
        setAwaitingBalance(false);
        setBalanceClientSecret(null);
        setCheckoutError(null);
      }
      invalidateBookingQueries();
    },
  });

  const bookingQuery = useQuery({
    queryKey: ['bookings', 'client', params.id],
    queryFn: () => apiFetchData<Booking>(`/bookings/mine/${params.id}`),
    refetchInterval: awaitingConfirmation || awaitingBalance ? POLL_INTERVAL_MS : false,
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

  const balancePaymentQuery = useQuery({
    queryKey: ['payments', 'balance', params.id],
    queryFn: async () => {
      try {
        return await apiFetchData<Payment>(`/payments/balances/${params.id}`);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(bookingQuery.data?.balanceStatus === 'due'),
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
    if (
      balancePaymentQuery.data?.clientSecret &&
      balancePaymentQuery.data.status === 'pending' &&
      !isIncompatibleMockClientSecret(balancePaymentQuery.data.clientSecret)
    ) {
      setBalanceClientSecret(balancePaymentQuery.data.clientSecret);
    }
  }, [balancePaymentQuery.data]);

  useEffect(() => {
    if (bookingQuery.data?.status === 'confirmed' || bookingQuery.data?.depositStatus === 'paid') {
      setAwaitingConfirmation(false);
      setClientSecret(null);
    }
  }, [bookingQuery.data?.depositStatus, bookingQuery.data?.status]);

  useEffect(() => {
    if (
      bookingQuery.data?.balanceStatus === 'paid_online' ||
      bookingQuery.data?.balanceStatus === 'paid_in_person'
    ) {
      setAwaitingBalance(false);
      setBalanceClientSecret(null);
    }
  }, [bookingQuery.data?.balanceStatus]);

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

  useEffect(() => {
    if (searchParams.get('balance') !== 'return') return;
    if (balanceReturnSyncStarted.current) return;
    if (
      !bookingQuery.data ||
      bookingQuery.data.balanceStatus === 'paid_online' ||
      bookingQuery.data.balanceStatus === 'paid_in_person'
    ) {
      return;
    }

    balanceReturnSyncStarted.current = true;
    setAwaitingBalance(true);
    syncBalanceMutation.mutate(undefined, {
      onError: (err) => {
        if (err instanceof ApiClientError && err.status === 409) {
          return;
        }
        setCheckoutError(getApiErrorMessage(err, 'Could not confirm your balance payment yet.'));
      },
    });
  }, [bookingQuery.data, searchParams, syncBalanceMutation]);

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

  const prepareBalanceCheckoutMutation = useMutation({
    mutationFn: () =>
      apiFetchData<DepositPaymentResponse>('/payments/balances', {
        method: 'POST',
        json: { bookingId: params.id },
      }),
    onSuccess: (data) => {
      setCheckoutError(null);
      if (isIncompatibleMockClientSecret(data.clientSecret)) {
        setBalanceClientSecret(null);
        setCheckoutError(incompatibleMockClientSecretMessage());
        return;
      }
      setBalanceClientSecret(data.clientSecret);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'balance', params.id] });
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

  const handleBalancePaymentComplete = useCallback(async () => {
    setCheckoutError(null);
    setAwaitingBalance(true);
    try {
      await syncBalanceMutation.mutateAsync();
      setAwaitingBalance(false);
      setBalanceClientSecret(null);
      invalidateBookingQueries();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        invalidateBookingQueries();
        return;
      }
      setCheckoutError(getApiErrorMessage(err, 'Payment succeeded but sync failed. Retrying…'));
      invalidateBookingQueries();
    }
  }, [invalidateBookingQueries, syncBalanceMutation]);

  const booking = bookingQuery.data;
  const payment = paymentQuery.data;
  const needsDeposit = booking?.status === 'held' && booking.depositStatus === 'pending';
  const needsBalance = booking?.balanceStatus === 'due' && Number(booking.remainingToPay) > 0;
  const canPayBalanceOnline =
    needsBalance && remainingBalanceAllowsOnlineCard(booking?.remainingBalanceMethod);
  const showMockSimulate = !stripeCheckoutEnabled && process.env.NODE_ENV !== 'production';

  const error =
    prepareCheckoutMutation.error ||
    prepareBalanceCheckoutMutation.error ||
    simulateMutation.error ||
    cancelMutation.error ||
    syncDepositMutation.error ||
    syncBalanceMutation.error
      ? getApiErrorMessage(
          prepareCheckoutMutation.error ??
            prepareBalanceCheckoutMutation.error ??
            simulateMutation.error ??
            cancelMutation.error ??
            syncDepositMutation.error ??
            syncBalanceMutation.error,
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
              {booking.stylistBusinessName ? (
                <div>
                  <dt className="text-ink-muted">Stylist</dt>
                  <dd className="font-medium text-ink">{booking.stylistBusinessName}</dd>
                </div>
              ) : null}
              {booking.serviceStyleName ? (
                <div>
                  <dt className="text-ink-muted">Style</dt>
                  <dd className="font-medium text-ink">
                    {[
                      booking.serviceCategoryName,
                      booking.serviceStyleName,
                      booking.serviceSizeTier,
                      booking.serviceLengthTier,
                      formatDurationLabel(booking.agreedDurationMinutes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </dd>
                </div>
              ) : null}
              {booking.remainingBalanceMethod ? (
                <div>
                  <dt className="text-ink-muted">Remaining balance</dt>
                  <dd className="font-medium text-ink">
                    {remainingBalanceMethodLabel(booking.remainingBalanceMethod)}
                  </dd>
                </div>
              ) : null}
              {booking.requirementsAcknowledgedAt ? (
                <div>
                  <dt className="text-ink-muted">Requirements</dt>
                  <dd className="font-medium text-ink">Acknowledged</dd>
                </div>
              ) : null}
              {(booking.addons?.length ?? 0) > 0 ? (
                <div>
                  <dt className="text-ink-muted">Add-ons</dt>
                  <dd className="font-medium text-ink">
                    {booking.addons.map((addon) => addon.name).join(', ')}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-muted">When</dt>
                <dd className="font-medium text-ink">{formatDateTime(booking.startTime)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Where</dt>
                <dd className="font-medium text-ink">
                  {serviceVenueModeLabel(booking.serviceVenueMode)}
                </dd>
              </div>
              {booking.venueAddress ? (
                <div>
                  <dt className="text-ink-muted">
                    {booking.serviceVenueMode === 'come_to_client'
                      ? 'Your address'
                      : booking.status === 'confirmed' || booking.status === 'completed'
                        ? 'Stylist location'
                        : 'Address'}
                  </dt>
                  <dd className="font-medium text-ink whitespace-pre-wrap">
                    {booking.venueAddress}
                  </dd>
                </div>
              ) : booking.serviceVenueMode === 'stylist_location' && booking.status === 'held' ? (
                <div>
                  <dt className="text-ink-muted">Stylist location</dt>
                  <dd className="font-medium text-ink-muted">
                    Full address shared when your booking is confirmed.
                  </dd>
                </div>
              ) : booking.serviceVenueMode === 'remote' ? (
                <div>
                  <dt className="text-ink-muted">Details</dt>
                  <dd className="font-medium text-ink">Your stylist will confirm how to join.</dd>
                </div>
              ) : null}
              {booking.holdExpiresAt ? (
                <div>
                  <dt className="text-ink-muted">Hold expires</dt>
                  <dd className="font-medium text-warning">
                    {formatDateTime(booking.holdExpiresAt)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-muted">Total</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.agreedPrice)}</dd>
              </div>
              {(booking.addons?.length ?? 0) > 0 ? (
                <div>
                  <dt className="text-ink-muted">Add-ons</dt>
                  <dd className="font-medium text-ink">
                    <ul className="mt-1 space-y-1">
                      {booking.addons.map((addon) => (
                        <li key={addon.serviceAddonId}>
                          {addon.name} — {formatMoney(addon.price)}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink-muted">Deposit</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.depositAmount)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Remaining balance</dt>
                <dd className="font-medium text-ink">{formatMoney(booking.balanceAmount)}</dd>
              </div>
              {booking.remainingBalanceMethod ? (
                <div>
                  <dt className="text-ink-muted">Accepted payment method</dt>
                  <dd className="font-medium text-ink">
                    {remainingBalanceMethodLabel(booking.remainingBalanceMethod)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <BookingMoneySummary booking={booking} audience="client" />

          {payment ? (
            <Card className="space-y-2">
              <p className="text-sm font-medium text-ink">Deposit payment</p>
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

          {awaitingBalance && needsBalance ? (
            <Card className="bg-primary-subtle border-primary/20">
              <p className="text-sm text-ink">Balance payment received — updating…</p>
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
              title="Pay your deposit"
              submitLabel="Pay deposit"
              returnQuery="deposit"
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

          {canPayBalanceOnline &&
          balanceClientSecret &&
          stripeCheckoutEnabled &&
          !isIncompatibleMockClientSecret(balanceClientSecret) ? (
            <DepositCheckout
              clientSecret={balanceClientSecret}
              bookingId={params.id}
              amountLabel={formatMoney(booking.remainingToPay)}
              title="Pay remaining balance"
              submitLabel="Pay balance"
              returnQuery="balance"
              onPaid={handleBalancePaymentComplete}
              onError={setCheckoutError}
            />
          ) : null}

          {canPayBalanceOnline && !balanceClientSecret && stripeCheckoutEnabled ? (
            <div className="space-y-2">
              <Button
                fullWidth
                onClick={() => prepareBalanceCheckoutMutation.mutate()}
                disabled={prepareBalanceCheckoutMutation.isPending}
              >
                {prepareBalanceCheckoutMutation.isPending
                  ? 'Preparing payment…'
                  : `Pay remaining ${formatMoney(booking.remainingToPay)} online`}
              </Button>
              <p className="text-xs text-ink-muted">
                Or pay in person at your appointment — your stylist will mark it received.
              </p>
            </div>
          ) : null}

          {needsBalance && !canPayBalanceOnline ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Remaining balance {formatMoney(booking.remainingToPay)} — pay at your appointment
                via {remainingBalanceMethodLabel(booking.remainingBalanceMethod)}. Online card
                payment is not available for this booking.
              </p>
            </Card>
          ) : null}

          {canPayBalanceOnline && !stripeCheckoutEnabled ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Remaining balance {formatMoney(booking.remainingToPay)} — pay in person at your
                appointment, or ask the operator to enable Stripe card checkout.
              </p>
            </Card>
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

          <Card className="space-y-3">
            <h2 className="font-medium text-ink">Book again</h2>
            <p className="text-sm text-ink-muted">
              Same stylist — keep this style or pick a different one.
            </p>
            <div className="grid gap-2">
              {booking.serviceOfferingId ? (
                <Link href={serviceBookingPath(booking.stylistId, booking.serviceOfferingId)}>
                  <Button type="button" fullWidth>
                    Book same style again
                  </Button>
                </Link>
              ) : null}
              <Link href={stylistBookingPath(booking.stylistId)}>
                <Button type="button" variant="secondary" fullWidth>
                  Choose a different style
                </Button>
              </Link>
              <SaveStylistButton stylistId={booking.stylistId} fullWidth />
            </div>
          </Card>

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
