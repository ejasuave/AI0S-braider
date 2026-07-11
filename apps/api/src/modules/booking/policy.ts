import type { BusinessPolicy, DepositDisposition } from '@project-braids/shared-types/api';

export function evaluateCancellationDeposit(
  policy: BusinessPolicy,
  booking: { startTime: Date },
  cancelledAt: Date,
): DepositDisposition {
  const hoursUntilStart = (booking.startTime.getTime() - cancelledAt.getTime()) / (60 * 60 * 1000);
  if (hoursUntilStart >= policy.cancellationWindowHours) {
    return 'full_refund';
  }
  return 'forfeit_deposit';
}

export function evaluateNoShowDeposit(policy: BusinessPolicy): DepositDisposition {
  if (policy.noShowFeeType === 'no_fee') {
    return 'no_action';
  }
  return 'forfeit_deposit';
}
