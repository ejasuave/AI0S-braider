import type { Prisma as PrismaTypes } from '@prisma/client';
import { transitionBookingStatus } from './state-machine.js';

export async function expireStaleHolds(
  tx: PrismaTypes.TransactionClient,
  stylistId?: string,
): Promise<number> {
  const now = new Date();
  const stale = await tx.booking.findMany({
    where: {
      status: 'held',
      holdExpiresAt: { lte: now },
      ...(stylistId ? { stylistId } : {}),
    },
    select: { id: true },
  });

  for (const booking of stale) {
    await transitionBookingStatus(tx, booking.id, 'held', 'cancelled', {
      cancelledAt: now,
      cancellationReason: 'hold_expired',
      holdExpiresAt: null,
    });
  }

  return stale.length;
}

/** Ch.7.6 — shared conflict detection for holds and manual bookings. */
export async function hasConflictingBooking(
  tx: PrismaTypes.TransactionClient,
  input: {
    stylistId: string;
    startTime: Date;
    endTime: Date;
    excludeBookingId?: string;
  },
): Promise<boolean> {
  const ids = await findConflictingBookingIds(tx, input);
  return ids.length > 0;
}

export async function findConflictingBookingIds(
  tx: PrismaTypes.TransactionClient,
  input: {
    stylistId: string;
    startTime: Date;
    endTime: Date;
    excludeBookingId?: string;
  },
): Promise<string[]> {
  const rows = input.excludeBookingId
    ? await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE stylist_id = ${input.stylistId}::uuid
          AND id <> ${input.excludeBookingId}::uuid
          AND status IN ('held', 'confirmed')
          AND (hold_expires_at IS NULL OR hold_expires_at > NOW())
          AND start_time < ${input.endTime}
          AND end_time > ${input.startTime}
        FOR UPDATE
      `
    : await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE stylist_id = ${input.stylistId}::uuid
          AND status IN ('held', 'confirmed')
          AND (hold_expires_at IS NULL OR hold_expires_at > NOW())
          AND start_time < ${input.endTime}
          AND end_time > ${input.startTime}
        FOR UPDATE
      `;
  return rows.map((row) => row.id);
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
