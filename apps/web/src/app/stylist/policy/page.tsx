'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { BusinessPolicy } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StylistPolicyPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [depositType, setDepositType] = useState<'percentage' | 'flat'>('percentage');
  const [depositValue, setDepositValue] = useState('20');
  const [cancellationWindowHours, setCancellationWindowHours] = useState('24');

  const policyQuery = useQuery({
    queryKey: ['business', 'policy'],
    queryFn: () => apiFetchData<BusinessPolicy>('/businesses/me/policy'),
  });

  useEffect(() => {
    if (policyQuery.data) {
      setDepositType(policyQuery.data.depositType);
      setDepositValue(String(policyQuery.data.depositValue));
      setCancellationWindowHours(String(policyQuery.data.cancellationWindowHours));
    }
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<BusinessPolicy>('/businesses/me/policy', {
        method: 'PATCH',
        json: {
          depositType,
          depositValue: Number(depositValue),
          cancellationWindowHours: Number(cancellationWindowHours),
          noShowFeeType: 'forfeit_deposit',
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'policy'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader title="Policies" subtitle="Deposit and cancellation rules for bookings." />
      <Card className="mt-6 space-y-4">
        {policyQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading policy…</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-ink">
              Deposit type
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as 'percentage' | 'flat')}
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount (£)</option>
              </select>
            </label>
            <Input
              label={depositType === 'percentage' ? 'Deposit (%)' : 'Deposit (£)'}
              type="number"
              min="1"
              value={depositValue}
              onChange={(e) => setDepositValue(e.target.value)}
              required
            />
            <Input
              label="Cancellation window (hours before appointment)"
              type="number"
              min="0"
              value={cancellationWindowHours}
              onChange={(e) => setCancellationWindowHours(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-error">{error}</p> : null}
            {saved ? <p className="text-sm text-success">Policy saved.</p> : null}
            <Button type="submit" fullWidth disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save policy'}
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
