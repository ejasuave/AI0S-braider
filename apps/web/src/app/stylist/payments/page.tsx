'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConnectStatusResponse } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

export default function StylistPaymentsPage() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['payments', 'connect'],
    queryFn: () => apiFetchData<ConnectStatusResponse>('/payments/connect/status'),
  });

  const onboardMutation = useMutation({
    mutationFn: () =>
      apiFetchData<{ onboardingUrl: string }>('/payments/connect/onboard', {
        method: 'POST',
        json: {},
      }),
    onSuccess: (data) => {
      window.location.href = data.onboardingUrl;
    },
  });

  const status = statusQuery.data;
  const error = onboardMutation.error ? getApiErrorMessage(onboardMutation.error) : null;

  return (
    <PageShell>
      <PageHeader title="Payments" subtitle="Connect Stripe to accept client deposits securely." />

      <div className="mt-6 space-y-4">
        <Card className="space-y-4">
          {statusQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading status…</p>
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
              </div>

              {process.env.NODE_ENV !== 'production' ? (
                <p className="text-sm text-ai">
                  Dev mode uses mock Stripe — onboarding completes when you follow the mock flow.
                </p>
              ) : null}

              {!status.onboardingComplete ? (
                <Button
                  fullWidth
                  onClick={() => onboardMutation.mutate()}
                  disabled={onboardMutation.isPending}
                >
                  {onboardMutation.isPending ? 'Starting…' : 'Connect with Stripe'}
                </Button>
              ) : (
                <p className="text-sm text-ink-muted">
                  You&apos;re ready to accept deposits on new bookings.
                </p>
              )}
            </>
          ) : null}
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </Card>

        <Button
          variant="secondary"
          fullWidth
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['payments', 'connect'] })}
        >
          Refresh status
        </Button>
      </div>
    </PageShell>
  );
}
