import type {
  BookingStatus,
  BookingDepositStatus,
  BalanceStatus,
} from '@project-braids/shared-types/api';
import type { Booking as DbBooking, Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  held: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export type BookingTransitionPatch = {
  depositStatus?: BookingDepositStatus;
  holdExpiresAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  balanceStatus?: BalanceStatus;
  balancePaidAt?: Date | null;
};

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw ApiError.validation(`Invalid booking transition from ${from} to ${to}`);
  }
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}

/**
 * Ch.7.1 — single write path for booking status changes.
 * All modules must transition status through this function.
 */
export async function transitionBookingStatus(
  tx: Prisma.TransactionClient,
  bookingId: string,
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
  patch: BookingTransitionPatch = {},
): Promise<DbBooking> {
  assertBookingTransition(fromStatus, toStatus);

  const updated = await tx.booking.updateMany({
    where: { id: bookingId, status: fromStatus },
    data: {
      status: toStatus,
      ...patch,
    },
  });

  if (updated.count === 0) {
    const current = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!current) {
      throw ApiError.notFound('Booking not found');
    }
    throw ApiError.validation(
      `Booking is ${current.status}; expected ${fromStatus} for transition to ${toStatus}`,
    );
  }

  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }
  return booking;
}
