'use client';

import { useCallback, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { getWebEnv } from '@/env';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripePublishableKey(): string | undefined {
  return getWebEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

export function isStripeCheckoutEnabled(): boolean {
  return Boolean(getStripePublishableKey());
}

export function isStripeTestMode(): boolean {
  return getStripePublishableKey()?.startsWith('pk_test_') ?? false;
}

/** Stripe test mode rejects real cards — surface a clearer message in dev. */
export function formatDepositPaymentError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    isStripeTestMode() &&
    (normalized.includes('declined') ||
      normalized.includes('payment failed') ||
      normalized.includes('card was declined'))
  ) {
    return `${message} Local dev uses Stripe test mode — use test card 4242 4242 4242 4242 (any future expiry, any CVC, any UK postcode). Real bank cards only work with live Stripe keys.`;
  }
  return message;
}

/** Mock API PaymentIntents cannot be mounted in real Stripe.js Elements. */
export function isMockClientSecret(clientSecret: string): boolean {
  return clientSecret.includes('_secret_mock') || clientSecret.startsWith('pi_mock_');
}

/** Mock dev secrets are invalid when the web app loads Stripe.js with any publishable key. */
export function isIncompatibleMockClientSecret(clientSecret: string): boolean {
  if (!getStripePublishableKey()) return false;
  return isMockClientSecret(clientSecret);
}

export function incompatibleMockClientSecretMessage(): string {
  const mode = isStripeTestMode() ? 'test' : 'live';
  return `Card checkout is enabled on web (${mode} publishable key) but the API returned a mock payment. Ensure STRIPE_SECRET_KEY is set in the repo root \`.env\` (matching ${mode} secret), then restart the API (\`pnpm dev\`). If keys are already set, an older API process may still be running in mock mode.`;
}

export function formatPaymentElementLoadError(error: { message?: string; type?: string }): string {
  const message = error.message?.trim();
  if (message) {
    return formatDepositPaymentError(message);
  }
  return 'Payment form could not load. Check that your Stripe keys match (test vs live) on web and API, then try Continue to payment again.';
}

function getStripePromise() {
  const key = getStripePublishableKey();
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

type CheckoutFormProps = {
  bookingId: string;
  amountLabel: string;
  onPaid: () => void;
  onError: (message: string) => void;
};

function CheckoutForm({ bookingId, amountLabel, onPaid, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [elementLoadFailed, setElementLoadFailed] = useState(false);

  const handleLoadError = useCallback(
    (event: { error: { message?: string; type?: string } }) => {
      setElementLoadFailed(true);
      onError(formatPaymentElementLoadError(event.error));
    },
    [onError],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!stripe || !elements) return;

      setSubmitting(true);
      onError('');

      const returnUrl = `${window.location.origin}/client/bookings/${bookingId}?deposit=return`;

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });

      if (error) {
        onError(formatDepositPaymentError(error.message ?? 'Payment could not be completed.'));
        setSubmitting(false);
        return;
      }

      onPaid();
      setSubmitting(false);
    },
    [bookingId, elements, onError, onPaid, stripe],
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
        onLoadError={handleLoadError}
      />
      {!elementLoadFailed ? (
        <>
          <Button type="submit" fullWidth disabled={!stripe || submitting}>
            {submitting ? 'Processing…' : `Pay ${amountLabel} deposit`}
          </Button>
          <p className="text-xs text-ink-muted">
            Deposits are processed securely by Stripe and sent to your stylist&apos;s account.
          </p>
          {isStripeTestMode() ? (
            <p className="text-xs text-ink-muted">
              Test mode: use card <strong>4242 4242 4242 4242</strong> — real bank cards are
              declined in test mode.
            </p>
          ) : null}
        </>
      ) : null}
    </form>
  );
}

type DepositCheckoutProps = {
  clientSecret: string;
  bookingId: string;
  amountLabel: string;
  onPaid: () => void;
  onError: (message: string) => void;
};

export function DepositCheckout({
  clientSecret,
  bookingId,
  amountLabel,
  onPaid,
  onError,
}: DepositCheckoutProps) {
  const stripe = getStripePromise();

  if (isIncompatibleMockClientSecret(clientSecret)) {
    return (
      <Card className="space-y-2 border-warning/30 bg-warning/5">
        <p className="text-sm text-ink">{incompatibleMockClientSecretMessage()}</p>
      </Card>
    );
  }

  if (!stripe) {
    return (
      <Card className="bg-warning/5 border-warning/30">
        <p className="text-sm text-ink">
          Card payments are not configured. Ask the platform operator to set{' '}
          <code className="text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
        </p>
      </Card>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#5c3d6e',
        borderRadius: '6px',
      },
    },
  };

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium text-ink">Pay your deposit</p>
      <Elements key={clientSecret} stripe={stripe} options={options}>
        <CheckoutForm
          bookingId={bookingId}
          amountLabel={amountLabel}
          onPaid={onPaid}
          onError={onError}
        />
      </Elements>
    </Card>
  );
}
