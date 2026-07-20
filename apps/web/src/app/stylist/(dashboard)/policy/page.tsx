'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { BusinessPolicy, RemainingBalanceMethod } from '@project-braids/shared-types/api';
import {
  REMAINING_BALANCE_METHODS,
  remainingBalanceMethodLabel,
} from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

const POLICY_FIELDS = [
  { key: 'cancellationPolicyText', label: 'Cancellation policy' },
  { key: 'reschedulingPolicyText', label: 'Rescheduling policy' },
  { key: 'lateArrivalPolicyText', label: 'Late arrival policy' },
  { key: 'noShowPolicyText', label: 'No-show policy' },
  { key: 'refundPolicyText', label: 'Refund policy' },
  { key: 'childrenPolicyText', label: 'Children policy' },
  { key: 'guestPolicyText', label: 'Guest policy' },
  { key: 'depositPolicyText', label: 'Deposit policy (client-facing notes)' },
] as const;

type PolicyTextKey = (typeof POLICY_FIELDS)[number]['key'];

export default function StylistPolicyPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [depositType, setDepositType] = useState<'percentage' | 'flat'>('percentage');
  const [depositValue, setDepositValue] = useState('20');
  const [cancellationWindowHours, setCancellationWindowHours] = useState('24');
  const [remainingBalanceMethod, setRemainingBalanceMethod] =
    useState<RemainingBalanceMethod>('cash_or_card');
  const [noShowFeeType, setNoShowFeeType] = useState<'forfeit_deposit' | 'flat_fee' | 'no_fee'>(
    'forfeit_deposit',
  );
  const [texts, setTexts] = useState<Record<PolicyTextKey, string>>({
    cancellationPolicyText: '',
    reschedulingPolicyText: '',
    lateArrivalPolicyText: '',
    noShowPolicyText: '',
    refundPolicyText: '',
    childrenPolicyText: '',
    guestPolicyText: '',
    depositPolicyText: '',
  });

  const policyQuery = useQuery({
    queryKey: ['business', 'policy'],
    queryFn: () => apiFetchData<BusinessPolicy>('/businesses/me/policy'),
  });

  useEffect(() => {
    if (policyQuery.data) {
      setDepositType(policyQuery.data.depositType);
      setDepositValue(String(policyQuery.data.depositValue));
      setCancellationWindowHours(String(policyQuery.data.cancellationWindowHours));
      setRemainingBalanceMethod(policyQuery.data.remainingBalanceMethod);
      setNoShowFeeType(policyQuery.data.noShowFeeType);
      setTexts({
        cancellationPolicyText: policyQuery.data.cancellationPolicyText ?? '',
        reschedulingPolicyText: policyQuery.data.reschedulingPolicyText ?? '',
        lateArrivalPolicyText: policyQuery.data.lateArrivalPolicyText ?? '',
        noShowPolicyText: policyQuery.data.noShowPolicyText ?? '',
        refundPolicyText: policyQuery.data.refundPolicyText ?? '',
        childrenPolicyText: policyQuery.data.childrenPolicyText ?? '',
        guestPolicyText: policyQuery.data.guestPolicyText ?? '',
        depositPolicyText: policyQuery.data.depositPolicyText ?? '',
      });
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
          noShowFeeType,
          remainingBalanceMethod,
          cancellationPolicyText: texts.cancellationPolicyText.trim() || null,
          reschedulingPolicyText: texts.reschedulingPolicyText.trim() || null,
          lateArrivalPolicyText: texts.lateArrivalPolicyText.trim() || null,
          noShowPolicyText: texts.noShowPolicyText.trim() || null,
          refundPolicyText: texts.refundPolicyText.trim() || null,
          childrenPolicyText: texts.childrenPolicyText.trim() || null,
          guestPolicyText: texts.guestPolicyText.trim() || null,
          depositPolicyText: texts.depositPolicyText.trim() || null,
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
      <PageHeader
        title="Policies"
        subtitle="Deposit rules, remaining balance method, and client-facing policies."
      />
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
            <label className="block text-sm font-medium text-ink">
              No-show handling
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={noShowFeeType}
                onChange={(e) =>
                  setNoShowFeeType(e.target.value as 'forfeit_deposit' | 'flat_fee' | 'no_fee')
                }
              >
                <option value="forfeit_deposit">Forfeit deposit</option>
                <option value="no_fee">No fee</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-ink">
              Remaining balance at appointment
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={remainingBalanceMethod}
                onChange={(e) =>
                  setRemainingBalanceMethod(e.target.value as RemainingBalanceMethod)
                }
              >
                {REMAINING_BALANCE_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {remainingBalanceMethodLabel[method]}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-4 border-t border-border pt-4">
              <h2 className="font-medium text-ink">Client-facing policy text</h2>
              <p className="text-sm text-ink-muted">
                Shown before booking. Leave blank to hide a section.
              </p>
              {POLICY_FIELDS.map((field) => (
                <Textarea
                  key={field.key}
                  label={field.label}
                  value={texts[field.key]}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  rows={3}
                />
              ))}
            </div>

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
