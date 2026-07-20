'use client';

import type { Booking } from '@project-braids/shared-types/api';
import { balanceStatusLabel, formatMoney } from '@/shared/lib/format';
import {
  remainingBalanceAllowsOnlineCard,
  remainingBalanceMethodLabel,
} from '@/shared/lib/pricing';
import { Card } from '@/shared/ui/card';
import { StatusBadge } from '@/shared/ui/status-badge';

type MoneySummaryProps = {
  booking: Booking;
  /** Client sees what they owe; stylist sees what they should receive. */
  audience: 'client' | 'stylist';
};

export function BookingMoneySummary({ booking, audience }: MoneySummaryProps) {
  const remaining = Number(booking.remainingToPay);
  const showRemaining = remaining > 0 && booking.balanceStatus === 'due';
  const balanceMethod = remainingBalanceMethodLabel(booking.remainingBalanceMethod);
  const onlineCardAllowed = remainingBalanceAllowsOnlineCard(booking.remainingBalanceMethod);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink">Payment summary</p>
        <StatusBadge label={balanceStatusLabel(booking.balanceStatus)} tone="neutral" />
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Service total</dt>
          <dd className="font-medium text-ink">{formatMoney(booking.agreedPrice)}</dd>
        </div>
        {Number(booking.homeVisitSurcharge) > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Includes home visit</dt>
            <dd className="font-medium text-ink">+{formatMoney(booking.homeVisitSurcharge)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Deposit</dt>
          <dd className="font-medium text-ink">{formatMoney(booking.depositAmount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Remaining after deposit</dt>
          <dd className="font-medium text-ink">{formatMoney(booking.balanceAmount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Balance payment method</dt>
          <dd className="font-medium text-ink">{balanceMethod}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Paid so far</dt>
          <dd className="font-medium text-ink">{formatMoney(booking.totalPaid)}</dd>
        </div>
        {showRemaining ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              {audience === 'client' ? 'Still to pay' : 'Client still owes'}
            </dt>
            <dd className="font-medium text-warning">{formatMoney(booking.remainingToPay)}</dd>
          </div>
        ) : null}
        {audience === 'stylist' ? (
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="text-ink-muted">Your expected total</dt>
            <dd className="font-medium text-ink">{formatMoney(booking.stylistExpectedTotal)}</dd>
          </div>
        ) : null}
      </dl>
      {showRemaining && audience === 'client' ? (
        <p className="text-xs text-ink-muted">
          {onlineCardAllowed
            ? 'Pay the remaining balance online now, or settle using the accepted methods at your appointment.'
            : `Pay the remaining balance at your appointment (${balanceMethod}). Online card payment is not available for this booking.`}
        </p>
      ) : null}
      {showRemaining && audience === 'stylist' ? (
        <p className="text-xs text-ink-muted">
          Client can settle via {balanceMethod.toLowerCase()}
          {onlineCardAllowed ? ', including online card,' : ''} or you can mark it paid when
          collected in person.
        </p>
      ) : null}
    </Card>
  );
}
