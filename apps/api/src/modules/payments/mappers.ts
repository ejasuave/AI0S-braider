import type { Payment as PaymentDto } from '@project-braids/shared-types/api';
import type { Payment, PaymentStatus } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export function toPayment(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    kind: payment.kind as PaymentDto['kind'],
    stripePaymentIntentId: payment.stripePaymentIntentId,
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    status: payment.status as PaymentDto['status'],
    createdAt: payment.createdAt.toISOString(),
    capturedAt: payment.capturedAt?.toISOString() ?? null,
    refundedAmount: payment.refundedAmount?.toFixed(2) ?? null,
  };
}

export function toPence(amount: Decimal | number): number {
  const value = typeof amount === 'number' ? amount : amount.toNumber();
  return Math.round(value * 100);
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === 'captured' || status === 'refunded' || status === 'forfeited' || status === 'failed'
  );
}
