'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  ConnectOnboardingResponse,
  IncomeReport,
  PayoutHistoryItem,
  StripeConnectStatus,
} from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

const ONBOARDING_TIMEOUT_MS = 30_000;

function formatOnboardError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Stripe onboarding timed out after 30 seconds. Check your connection and try again.';
  }
  const message = getApiErrorMessage(error, 'Could not start Stripe onboarding');
  if (
    error instanceof TypeError &&
    (message.includes('fetch') || message.includes('NetworkError'))
  ) {
    return 'Cannot reach the API server. Stop pnpm dev (Ctrl+C), run pnpm dev again, then retry Connect.';
  }
  if (message.includes('platform-profile') || message.includes('managing losses')) {
    return `${message} Complete your Connect platform profile at https://dashboard.stripe.com/settings/connect/platform-profile then try again.`;
  }
  if (
    message.includes('localhost') &&
    (message.includes('testmode') || message.includes('test mode'))
  ) {
    return 'Live Stripe keys cannot use localhost return URLs. For local dev, use sk_test_/pk_test_ keys in .env, or set STRIPE_CONNECT_RETURN_URL to an HTTPS URL (e.g. ngrok tunnel).';
  }
  if (message.includes('Live Stripe keys cannot use localhost')) {
    return message;
  }
  if (message.includes('Connect → Get started') || message.includes('platform profile')) {
    return message;
  }
  return message;
}

export default function StylistPaymentsPage() {
  const queryClient = useQueryClient();
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [slowOnboarding, setSlowOnboarding] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['payments', 'stripe', 'status'],
    queryFn: () => apiFetchData<StripeConnectStatus>('/businesses/me/stripe/status'),
    retry: 1,
  });

  const status = statusQuery.data;
  const isReady = Boolean(status?.connected && status.chargesEnabled);

  const payoutsQuery = useQuery({
    queryKey: ['payments', 'payouts'],
    queryFn: () => apiFetchData<PayoutHistoryItem[]>('/businesses/me/payouts'),
    enabled: isReady,
    retry: 1,
  });

  const incomeQuery = useQuery({
    queryKey: ['payments', 'income-report'],
    queryFn: () => apiFetchData<IncomeReport>('/businesses/me/income-report'),
    enabled: isReady,
    retry: 1,
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), ONBOARDING_TIMEOUT_MS);
      try {
        return await apiFetchData<ConnectOnboardingResponse>(
          '/businesses/me/stripe/onboarding-link',
          {
            method: 'GET',
            signal: controller.signal,
          },
        );
      } finally {
        window.clearTimeout(timeout);
      }
    },
    onSuccess: (data) => {
      setSlowOnboarding(false);
      if (!data.onboardingUrl) {
        throw new Error('Stripe did not return an onboarding URL');
      }
      setOnboardingUrl(data.onboardingUrl);
      window.location.assign(data.onboardingUrl);
    },
    onError: () => {
      setSlowOnboarding(false);
    },
  });

  useEffect(() => {
    if (!onboardMutation.isPending) {
      setSlowOnboarding(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowOnboarding(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [onboardMutation.isPending]);

  const statusError = statusQuery.error ? getApiErrorMessage(statusQuery.error) : null;
  const onboardError = onboardMutation.error ? formatOnboardError(onboardMutation.error) : null;
  const isRestricted = status?.onboardingStatus === 'restricted';
  const showConnectButton = !status?.connected || !status.onboardingComplete;
  const connectButtonLabel = isRestricted
    ? 'Continue Stripe setup'
    : onboardMutation.isPending
      ? 'Starting…'
      : 'Connect with Stripe';

  return (
    <PageShell>
      <PageHeader
        title="Payments"
        subtitle="Stripe Connect deposits, payouts, and income reporting."
      />

      <div className="mt-6 space-y-4">
        <Card className="space-y-4">
          {statusQuery.isPending ? (
            <p className="text-sm text-ink-muted">Loading status…</p>
          ) : statusError ? (
            <div className="space-y-3">
              <p className="text-sm text-error">{statusError}</p>
              <Button fullWidth onClick={() => void statusQuery.refetch()} variant="secondary">
                Retry status
              </Button>
            </div>
          ) : status ? (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={status.connected ? 'Connected' : 'Not connected'}
                  tone={status.connected ? 'success' : 'warning'}
                />
                <StatusBadge
                  label={status.chargesEnabled ? 'Charges enabled' : 'Charges pending'}
                  tone={status.chargesEnabled ? 'success' : 'warning'}
                />
                <StatusBadge
                  label={status.onboardingComplete ? 'Onboarding complete' : 'Setup incomplete'}
                  tone={status.onboardingComplete ? 'success' : 'warning'}
                />
                {isRestricted ? <StatusBadge label="Action required" tone="warning" /> : null}
              </div>

              {isRestricted ? (
                <p className="text-sm text-ink-muted">
                  Your Stripe account needs a few more details (business category, website, bank
                  account, and terms). Click <strong>Continue Stripe setup</strong> below to finish
                  in Stripe, then return here and press Refresh.
                </p>
              ) : status.connected && status.chargesEnabled ? (
                <p className="text-sm text-ink-muted">
                  You&apos;re ready to accept deposits on new bookings.
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  Complete Stripe onboarding to accept client deposits. Funds route to your
                  connected account; Stripe pays out to your bank on their schedule.
                </p>
              )}
            </>
          ) : null}

          {showConnectButton && !isRestricted ? (
            <Card className="space-y-2 border-warning/40 bg-warning/5">
              <p className="text-sm font-medium text-ink">Required before Connect works</p>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-ink-muted">
                <li>
                  Complete your{' '}
                  <a
                    href="https://dashboard.stripe.com/settings/connect/platform-profile"
                    className="font-medium text-primary underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Stripe Connect platform profile
                  </a>{' '}
                  (including loss responsibilities).
                </li>
                <li>
                  Ensure{' '}
                  <a
                    href="https://dashboard.stripe.com/connect"
                    className="font-medium text-primary underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Connect is enabled
                  </a>{' '}
                  in your Stripe Dashboard.
                </li>
                <li>
                  Restart <code className="text-xs">pnpm dev</code> if Connect was timing out.
                </li>
              </ol>
            </Card>
          ) : null}

          {showConnectButton ? (
            <Button
              fullWidth
              onClick={() => onboardMutation.mutate()}
              disabled={onboardMutation.isPending || statusQuery.isPending}
            >
              {onboardMutation.isPending ? 'Starting…' : connectButtonLabel}
            </Button>
          ) : null}

          {onboardMutation.isPending && slowOnboarding ? (
            <p className="text-sm text-ink-muted">
              Contacting Stripe… this can take up to 30 seconds. If it fails, ensure Connect is
              enabled in your Stripe Dashboard (Connect → Get started).
            </p>
          ) : null}

          {onboardError ? <p className="text-sm text-error">{onboardError}</p> : null}

          {onboardingUrl ? (
            <Card className="space-y-2 border-primary/30 bg-primary-subtle">
              <p className="text-sm text-ink">
                If you were not redirected automatically, open Stripe onboarding manually:
              </p>
              <a
                href={onboardingUrl}
                className="text-sm font-medium text-primary underline"
                target="_self"
                rel="noopener noreferrer"
              >
                Continue to Stripe →
              </a>
            </Card>
          ) : null}
        </Card>

        {incomeQuery.data ? (
          <Card className="space-y-3">
            <h2 className="font-medium text-ink">Income summary</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">Captured</dt>
                <dd className="font-medium text-ink">
                  {formatMoney(incomeQuery.data.totalCaptured)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Forfeited</dt>
                <dd className="font-medium text-ink">
                  {formatMoney(incomeQuery.data.totalForfeited)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Refunded</dt>
                <dd className="font-medium text-ink">
                  {formatMoney(incomeQuery.data.totalRefunded)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Completed / no-show</dt>
                <dd className="font-medium text-ink">
                  {incomeQuery.data.completedBookings} / {incomeQuery.data.noShowBookings}
                </dd>
              </div>
            </dl>
          </Card>
        ) : null}

        {payoutsQuery.data && payoutsQuery.data.length > 0 ? (
          <Card className="space-y-3">
            <h2 className="font-medium text-ink">Recent payouts (from Stripe)</h2>
            <ul className="space-y-2">
              {payoutsQuery.data.map((payout) => (
                <li key={payout.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-medium text-ink">
                    {formatMoney(payout.amount, payout.currency.toUpperCase())}
                  </p>
                  <p className="text-ink-muted">
                    {payout.status} · arrives {formatDateTime(payout.arrivalDate)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['payments'] });
          }}
        >
          Refresh
        </Button>
      </div>
    </PageShell>
  );
}
