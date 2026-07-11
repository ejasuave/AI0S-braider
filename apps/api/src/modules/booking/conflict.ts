import type { Prisma } from '@prisma/client';

export async function expireStaleHolds(
  tx: Prisma.TransactionClient,
  stylistId?: string,
): Promise<number> {
  const now = new Date();
  const result = await tx.booking.updateMany({
    where: {
      status: 'held',
      holdExpiresAt: { lte: now },
      ...(stylistId ? { stylistId } : {}),
    },
    data: {
      status: 'cancelled',
      cancelledAt: now,
      cancellationReason: 'hold_expired',
      holdExpiresAt: null,
    },
  });
  return result.count;
}

export async function findConflictingBookingIds(
  tx: Prisma.TransactionClient,
  input: { stylistId: string; startTime: Date; endTime: Date },
): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
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
