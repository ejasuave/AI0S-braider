import type {
  Booking,
  BookingDepositStatus,
  BookingSource,
  BookingStatus,
} from '@project-braids/shared-types/api';
import type { Booking as DbBooking } from '@prisma/client';

function toIso(date: Date): string {
  return date.toISOString();
}

export function toBooking(
  booking: DbBooking,
  options?: { requireStylistApproval?: boolean },
): Booking {
  const pendingStylistApproval =
    options?.requireStylistApproval === true &&
    booking.status === 'held' &&
    booking.source === 'ai_agent' &&
    booking.stylistApprovedAt === null;

  return {
    id: booking.id,
    stylistId: booking.stylistId,
    clientId: booking.clientId,
    serviceOfferingId: booking.serviceOfferingId,
    status: booking.status as BookingStatus,
    startTime: toIso(booking.startTime),
    endTime: toIso(booking.endTime),
    agreedPrice: booking.agreedPrice.toString(),
    agreedDurationMinutes: booking.agreedDurationMinutes,
    depositAmount: booking.depositAmount.toString(),
    depositStatus: booking.depositStatus as BookingDepositStatus,
    holdExpiresAt: booking.holdExpiresAt ? toIso(booking.holdExpiresAt) : null,
    source: booking.source as BookingSource,
    createdAt: toIso(booking.createdAt),
    cancelledAt: booking.cancelledAt ? toIso(booking.cancelledAt) : null,
    cancellationReason: booking.cancellationReason,
    stylistApprovedAt: booking.stylistApprovedAt ? toIso(booking.stylistApprovedAt) : null,
    ...(pendingStylistApproval ? { pendingStylistApproval: true } : {}),
  };
}

export function calculateDepositAmount(
  basePrice: number,
  depositPolicy: { type: 'flat' | 'percent'; value: number } | null | undefined,
): number {
  if (!depositPolicy) {
    return 0;
  }
  if (depositPolicy.type === 'flat') {
    return Math.min(basePrice, depositPolicy.value);
  }
  return Math.round(((basePrice * depositPolicy.value) / 100) * 100) / 100;
}

export function calculateBookingEndTime(
  startTime: Date,
  durationMinutes: number,
  bufferMinutes: number,
): Date {
  return new Date(startTime.getTime() + (durationMinutes + bufferMinutes) * 60_000);
}
