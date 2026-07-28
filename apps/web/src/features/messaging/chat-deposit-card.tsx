'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { DepositPaymentResponse, Payment } from '@project-braids/shared-types/api';
import {
  DepositCheckout,
  formatDepositPaymentError,
  isIncompatibleMockClientSecret,
  isStripeCheckoutEnabled,
} from '@/features/payments/deposit-checkout';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';

export type ChatDepositPayload = {
  bookingId: string;
  paymentId?: string;
  amount?: string;
};

export function parseChatDepositPayload(
  structuredOutput: Record<string, unknown> | null | undefined,
): ChatDepositPayload | null {
  if (!structuredOutput) return null;

  const nextAction = structuredOutput.next_action;
  const bookingId =
    typeof structuredOutput.booking_id === 'string'
      ? structuredOutput.booking_id
      : typeof structuredOutput.extracted_slots === 'object' &&
          structuredOutput.extracted_slots !== null &&
          typeof (structuredOutput.extracted_slots as { bookingId?: unknown }).bookingId ===
            'string'
        ? (structuredOutput.extracted_slots as { bookingId: string }).bookingId
        : null;

  if (!bookingId) return null;

  const hasDepositSignal =
    nextAction === 'send_deposit_link' ||
    typeof structuredOutput.payment_id === 'string' ||
    typeof structuredOutput.deposit_amount === 'string';

  if (!hasDepositSignal) return null;

  return {
    bookingId,
    paymentId:
      typeof structuredOutput.payment_id === 'string' ? structuredOutput.payment_id : undefined,
    amount:
      typeof structuredOutput.deposit_amount === 'string'
        ? structuredOutput.deposit_amount
        : undefined,
  };
}

type SyncDepositResponse = { payment: Payment; bookingConfirmed: boolean };

type ChatDepositCardProps = {
  conversationId: string;
  payload: ChatDepositPayload;
};

export function ChatDepositCard({ conversationId, payload }: ChatDepositCardProps) {
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const paymentQuery = useQuery({
    queryKey: ['payments', 'deposit', payload.bookingId],
    queryFn: () => apiFetchData<Payment>(`/payments/deposits/${payload.bookingId}`),
    enabled: !paid,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetchData<DepositPaymentResponse>('/payments/deposits', {
        method: 'POST',
        body: JSON.stringify({ bookingId: payload.bookingId }),
      }),
    onSuccess: (data) => {
      if (isIncompatibleMockClientSecret(data.clientSecret)) {
        setError(
          'Card checkout is not available with the current payment configuration. Use the booking page link instead.',
        );
        return;
      }
      setClientSecret(data.clientSecret);
      setError(null);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetchData<SyncDepositResponse>(`/payments/deposits/${payload.bookingId}/sync`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: async (result) => {
      if (result.bookingConfirmed || result.payment.status === 'captured') {
        setPaid(true);
        setClientSecret(null);
        await queryClient.invalidateQueries({
          queryKey: ['messaging', 'client', 'conversation', conversationId],
        });
        await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
    },
    onError: (err) => setError(formatDepositPaymentError(getApiErrorMessage(err))),
  });

  useEffect(() => {
    if (paymentQuery.data?.status === 'captured') {
      setPaid(true);
      return;
    }
    if (
      paymentQuery.data?.clientSecret &&
      !isIncompatibleMockClientSecret(paymentQuery.data.clientSecret)
    ) {
      setClientSecret(paymentQuery.data.clientSecret);
    }
  }, [paymentQuery.data]);

  const amountLabel = `£${payload.amount ?? paymentQuery.data?.amount ?? '—'}`;
  const bookingHref = `/client/bookings/${payload.bookingId}`;

  const handlePaid = useCallback(() => {
    void syncMutation.mutateAsync();
  }, [syncMutation]);

  if (paid) {
    return (
      <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink">
        Deposit paid. Your booking will confirm shortly.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-surface px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">Pay deposit {amountLabel}</p>
        <p className="text-xs text-ink-muted">
          Pay here in chat, or open your booking page.
        </p>
      </div>

      {error ? <p className="text-xs text-error">{error}</p> : null}

      {clientSecret && isStripeCheckoutEnabled() ? (
        <DepositCheckout
          clientSecret={clientSecret}
          bookingId={payload.bookingId}
          amountLabel={amountLabel}
          title="Pay deposit in chat"
          submitLabel="Pay deposit"
          returnQuery="deposit"
          onPaid={handlePaid}
          onError={(message) => setError(message || null)}
        />
      ) : (
        <Button
          type="button"
          fullWidth
          disabled={createMutation.isPending || !isStripeCheckoutEnabled()}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending
            ? 'Preparing…'
            : isStripeCheckoutEnabled()
              ? `Pay ${amountLabel} in chat`
              : 'Card pay unavailable'}
        </Button>
      )}

      <Link
        href={bookingHref}
        className="block text-center text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Open booking page
      </Link>
    </div>
  );
}
