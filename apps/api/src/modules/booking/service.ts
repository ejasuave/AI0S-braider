import type {
  Booking,
  BookingListQuery,
  CancelBookingRequest,
  CreateBookingHoldRequest,
  CreateManualBookingRequest,
} from '@project-braids/shared-types/api';
import type { BookingSource } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { getSystemQueue, JOB_NAMES } from '../../lib/queue.js';
import { profileService } from '../profile/service.js';
import { expireStaleHolds, findConflictingBookingIds } from './conflict.js';
import {
  calculateBookingEndTime,
  calculateDepositAmount,
  toBooking,
} from './mappers.js';
import { assertBookingTransition } from './state-machine.js';

type CreateBookingInput = {
  stylistId: string;
  clientId: string;
  serviceOfferingId: string;
  startTime: Date;
  source: BookingSource;
  status: 'held' | 'confirmed';
};

export class BookingService {
  private holdTtlMs(): number {
    return getEnv().BOOKING_HOLD_TTL_MINUTES * 60_000;
  }

  async listBookings(stylistId: string, query: BookingListQuery): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        stylistId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              startTime: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { startTime: 'asc' },
    });
    return bookings.map(toBooking);
  }

  async getBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    return toBooking(booking);
  }

  async getBookingForClient(clientId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    return toBooking(booking);
  }

  async createHold(clientId: string, input: CreateBookingHoldRequest): Promise<Booking> {
    return this.createBookingRecord({
      stylistId: input.stylistId,
      clientId,
      serviceOfferingId: input.serviceOfferingId,
      startTime: new Date(input.startTime),
      source: input.source as BookingSource,
      status: 'held',
    });
  }

  async createManualBooking(
    stylistId: string,
    input: CreateManualBookingRequest,
  ): Promise<Booking> {
    return this.createBookingRecord({
      stylistId,
      clientId: input.clientId,
      serviceOfferingId: input.serviceOfferingId,
      startTime: new Date(input.startTime),
      source: 'dashboard_manual',
      status: input.confirmImmediately ? 'confirmed' : 'held',
    });
  }

  private async createBookingRecord(input: CreateBookingInput): Promise<Booking> {
    const offering = await profileService.getActiveServiceOffering(
      input.stylistId,
      input.serviceOfferingId,
    );
    const scheduling = await profileService.getSchedulingSettings(input.stylistId);
    const startTime = input.startTime;
    const endTime = calculateBookingEndTime(
      startTime,
      offering.estimatedDurationMinutes,
      scheduling.bufferMinutes,
    );

    if (endTime <= startTime) {
      throw ApiError.validation('Invalid booking duration');
    }

    const agreedPrice = offering.basePrice.toNumber();
    const depositAmount = calculateDepositAmount(agreedPrice, scheduling.depositPolicy);
    const holdExpiresAt =
      input.status === 'held' ? new Date(Date.now() + this.holdTtlMs()) : null;

    const booking = await prisma.$transaction(async (tx) => {
      await expireStaleHolds(tx, input.stylistId);

      const conflicts = await findConflictingBookingIds(tx, {
        stylistId: input.stylistId,
        startTime,
        endTime,
      });
      if (conflicts.length > 0) {
        throw new ApiError('CONFLICT', 'Requested slot is no longer available', 409);
      }

      return tx.booking.create({
        data: {
          stylistId: input.stylistId,
          clientId: input.clientId,
          serviceOfferingId: input.serviceOfferingId,
          status: input.status,
          startTime,
          endTime,
          agreedPrice,
          agreedDurationMinutes: offering.estimatedDurationMinutes,
          depositAmount,
          depositStatus: 'pending',
          holdExpiresAt,
          source: input.source,
        },
      });
    });

    if (booking.status === 'held' && booking.holdExpiresAt) {
      const delay = Math.max(booking.holdExpiresAt.getTime() - Date.now(), 0);
      try {
        await getSystemQueue().add(
          JOB_NAMES.BOOKING_EXPIRE_HOLD,
          { bookingId: booking.id },
          { jobId: `booking-expire-${booking.id}`, delay },
        );
      } catch {
        // Redis unavailable in some dev/test environments — lazy expiry still applies.
      }
    }

    return toBooking(booking);
  }

  async confirmBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    assertBookingTransition(booking.status, 'confirmed');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'confirmed',
        holdExpiresAt: null,
      },
    });

    return toBooking(updated);
  }

  async confirmBookingAsClient(clientId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    assertBookingTransition(booking.status, 'confirmed');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'confirmed',
        holdExpiresAt: null,
      },
    });

    return toBooking(updated);
  }

  async cancelBooking(
    stylistId: string,
    bookingId: string,
    input: CancelBookingRequest,
  ): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    assertBookingTransition(booking.status, 'cancelled');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? 'cancelled_by_stylist',
        holdExpiresAt: null,
      },
    });

    return toBooking(updated);
  }

  async completeBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    assertBookingTransition(booking.status, 'completed');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'completed' },
    });

    return toBooking(updated);
  }

  async markNoShow(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    assertBookingTransition(booking.status, 'no_show');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'no_show' },
    });

    return toBooking(updated);
  }
}

export const bookingService = new BookingService();
