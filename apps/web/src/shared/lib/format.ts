import type { BookingStatus, BookingDepositStatus } from '@project-braids/shared-types/api';
import type { PaymentStatus } from '@project-braids/shared-types/api';

export function formatMoney(amount: string, currency = 'GBP'): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return amount;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function bookingStatusLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    held: 'On hold',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No show',
  };
  return labels[status];
}

export function bookingStatusTone(
  status: BookingStatus,
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'held':
      return 'warning';
    case 'cancelled':
    case 'no_show':
      return 'error';
    default:
      return 'neutral';
  }
}

export function depositStatusLabel(status: BookingDepositStatus): string {
  const labels: Record<BookingDepositStatus, string> = {
    pending: 'Deposit pending',
    paid: 'Deposit paid',
    refunded: 'Refunded',
    forfeited: 'Forfeited',
  };
  return labels[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Pending',
    captured: 'Paid',
    refunded: 'Refunded',
    forfeited: 'Forfeited',
    failed: 'Failed',
  };
  return labels[status];
}
