import type { BookingStatus } from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  held: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw ApiError.validation(`Invalid booking transition from ${from} to ${to}`);
  }
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}
