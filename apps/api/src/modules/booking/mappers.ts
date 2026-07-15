import type {
  BalanceStatus,
  Booking,
  BookingAddonSnapshot,
  BookingDepositStatus,
  BookingSource,
  BookingStatus,
  ServiceVenueMode,
} from '@project-braids/shared-types/api';
import type { Booking as DbBooking, Prisma } from '@prisma/client';

function toIso(date: Date): string {
  return date.toISOString();
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export type BookingMapOptions = {
  requireStylistApproval?: boolean;
  audience?: 'stylist' | 'client';
  clientPhoneNumber?: string | null;
};

function shouldRevealVenueAddress(
  booking: DbBooking,
  audience: 'stylist' | 'client',
): boolean {
  if (audience === 'stylist') return true;
  if (booking.serviceVenueMode === 'come_to_client') return true;
  if (booking.serviceVenueMode === 'remote') return false;
  return booking.status === 'confirmed' || booking.status === 'completed';
}

/** Balance portion of the service total (after deposit). */
export function calculateBalanceAmount(agreedPrice: number, depositAmount: number): number {
  return Math.max(0, Math.round((agreedPrice - depositAmount) * 100) / 100);
}

export function parseAddonsSnapshot(value: Prisma.JsonValue | null): BookingAddonSnapshot[] {
  if (!value || !Array.isArray(value)) return [];
  const result: BookingAddonSnapshot[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.serviceAddonId === 'string' &&
      typeof row.name === 'string' &&
      (typeof row.description === 'string' || row.description === null || row.description === undefined) &&
      (typeof row.price === 'string' || typeof row.price === 'number')
    ) {
      result.push({
        serviceAddonId: row.serviceAddonId,
        name: row.name,
        description: typeof row.description === 'string' ? row.description : null,
        price: typeof row.price === 'number' ? money(row.price) : row.price,
      });
    }
  }
  return result;
}

export function deriveMoneySummary(booking: DbBooking): {
  balanceAmount: string;
  remainingToPay: string;
  totalPaid: string;
  stylistExpectedTotal: string;
} {
  const agreed = Number(booking.agreedPrice);
  const deposit = Number(booking.depositAmount);
  const balanceAmount = calculateBalanceAmount(agreed, deposit);

  const depositCounted =
    booking.depositStatus === 'paid' || booking.depositStatus === 'forfeited';
  const balanceCounted =
    booking.balanceStatus === 'paid_online' || booking.balanceStatus === 'paid_in_person';

  let paid = 0;
  if (depositCounted) paid += deposit;
  if (balanceCounted) paid += balanceAmount;

  const remaining = Math.max(0, Math.round((agreed - paid) * 100) / 100);

  // What stylist should expect to receive for this booking over its lifetime
  let stylistExpected = paid;
  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    if (booking.depositStatus === 'refunded') {
      stylistExpected = balanceCounted && booking.balanceStatus === 'paid_in_person' ? balanceAmount : 0;
      // online balance refunds are processed with full_refund — treat as not kept
      if (booking.balanceStatus === 'paid_online') {
        stylistExpected = 0;
      }
    }
  } else if (depositCounted && !balanceCounted) {
    // Deposit paid; balance still expected in person or online before/at appointment
    stylistExpected = agreed;
  }

  return {
    balanceAmount: money(balanceAmount),
    remainingToPay: money(remaining),
    totalPaid: money(paid),
    stylistExpectedTotal: money(stylistExpected),
  };
}

export function toBooking(booking: DbBooking, options?: BookingMapOptions): Booking {
  const audience = options?.audience ?? 'stylist';
  const pendingStylistApproval =
    options?.requireStylistApproval === true &&
    booking.status === 'held' &&
    booking.source === 'ai_agent' &&
    booking.stylistApprovedAt === null;

  const venueAddress = shouldRevealVenueAddress(booking, audience)
    ? booking.venueAddress
    : null;

  const moneySummary = deriveMoneySummary(booking);

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
    serviceVenueMode: booking.serviceVenueMode as ServiceVenueMode,
    venueAddress,
    homeVisitSurcharge: booking.homeVisitSurcharge.toString(),
    clientDisplayName: booking.clientDisplayName,
    ...(audience === 'stylist'
      ? { clientPhoneNumber: options?.clientPhoneNumber ?? null }
      : {}),
    balanceStatus: booking.balanceStatus as BalanceStatus,
    balancePaidAt: booking.balancePaidAt ? toIso(booking.balancePaidAt) : null,
    ...moneySummary,
    addons: parseAddonsSnapshot(booking.addonsSnapshot),
    remainingBalanceMethod: booking.remainingBalanceMethod ?? null,
    requirementsAcknowledgedAt: booking.requirementsAcknowledgedAt
      ? toIso(booking.requirementsAcknowledgedAt)
      : null,
    policiesAcknowledgedAt: booking.policiesAcknowledgedAt
      ? toIso(booking.policiesAcknowledgedAt)
      : null,
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
