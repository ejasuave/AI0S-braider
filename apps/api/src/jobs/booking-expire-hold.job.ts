import type { Job } from 'bullmq';
import { prisma } from '../lib/db.js';
import { transitionBookingStatus } from '../modules/booking/state-machine.js';

export type BookingExpireHoldJobData = {
  bookingId: string;
};

export async function processBookingExpireHoldJob(
  job: Job<BookingExpireHoldJobData>,
): Promise<{ expired: boolean }> {
  const booking = await prisma.booking.findUnique({ where: { id: job.data.bookingId } });
  if (!booking || booking.status !== 'held' || !booking.holdExpiresAt) {
    return { expired: false };
  }

  if (booking.holdExpiresAt.getTime() > Date.now()) {
    return { expired: false };
  }

  await prisma.$transaction(async (tx) => {
    await transitionBookingStatus(tx, booking.id, 'held', 'cancelled', {
      cancelledAt: new Date(),
      cancellationReason: 'hold_expired',
      holdExpiresAt: null,
    });
  });

  return { expired: true };
}

export async function processBookingSweepHoldsJob(): Promise<{ expiredCount: number }> {
  const { expireStaleHolds } = await import('../modules/booking/conflict.js');
  const expiredCount = await prisma.$transaction(async (tx) => expireStaleHolds(tx));
  return { expiredCount };
}
