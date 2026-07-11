import type {
  AvailabilityQuery,
  AvailabilityResponse,
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
import { notificationsService } from '../notifications/service.js';
import { expireStaleHolds, findConflictingBookingIds } from './conflict.js';
import { calculateBookingEndTime, calculateDepositAmount, toBooking } from './mappers.js';
import { assertBookingTransition } from './state-machine.js';
import { generateAvailabilitySlots, slotMatchesAvailability } from './availability.js';

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

  async listClientBookings(clientId: string, query: BookingListQuery): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        clientId,
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
      skipAvailabilityCheck: true,
    });
  }

  async getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const env = getEnv();
    const from = query.from ? new Date(query.from) : new Date();
    const maxRangeMs = env.AVAILABILITY_MAX_DAYS * 24 * 60 * 60 * 1000;
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + maxRangeMs);

    if (to <= from) {
      throw ApiError.validation('`to` must be after `from`');
    }

    const offering = await profileService.getActiveServiceOffering(
      query.stylistId,
      query.serviceOfferingId,
    );
    const availabilityContext = await profileService.getAvailabilityContext(query.stylistId);
    const blockingBookings = await this.getBlockingBookings(query.stylistId, from, to);

    const slots = generateAvailabilitySlots({
      from,
      to,
      timeZone: env.PLATFORM_TIMEZONE,
      workingHours: availabilityContext.workingHours,
      durationMinutes: offering.estimatedDurationMinutes,
      bufferMinutes: availabilityContext.bufferMinutes,
      slotIntervalMinutes: env.AVAILABILITY_SLOT_INTERVAL_MINUTES,
      blockingBookings,
      limit: query.limit,
    });

    return {
      stylistId: query.stylistId,
      serviceOfferingId: query.serviceOfferingId,
      timezone: env.PLATFORM_TIMEZONE,
      slots,
    };
  }

  private async getBlockingBookings(stylistId: string, from: Date, to: Date) {
    await prisma.$transaction(async (tx) => {
      await expireStaleHolds(tx, stylistId);
    });

    return prisma.booking.findMany({
      where: {
        stylistId,
        status: { in: ['held', 'confirmed'] },
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
        startTime: { lt: to },
        endTime: { gt: from },
      },
      select: { startTime: true, endTime: true },
    });
  }

  private async createBookingRecord(
    input: CreateBookingInput & { skipAvailabilityCheck?: boolean },
  ): Promise<Booking> {
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

    if (!input.skipAvailabilityCheck) {
      const availability = await this.getAvailability({
        stylistId: input.stylistId,
        serviceOfferingId: input.serviceOfferingId,
        from: startTime.toISOString(),
        to: new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        limit: 100,
      });
      if (!slotMatchesAvailability(availability.slots, startTime)) {
        throw new ApiError('CONFLICT', 'Requested slot is not available', 409);
      }
    }

    const agreedPrice = offering.basePrice.toNumber();
    const depositAmount = calculateDepositAmount(agreedPrice, scheduling.depositPolicy);
    const holdExpiresAt = input.status === 'held' ? new Date(Date.now() + this.holdTtlMs()) : null;

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
      void getSystemQueue()
        .add(
          JOB_NAMES.BOOKING_EXPIRE_HOLD,
          { bookingId: booking.id },
          { jobId: `booking-expire-${booking.id}`, delay },
        )
        .catch(() => {
          // Redis unavailable in some dev/test environments — lazy expiry still applies.
        });
    }

    if (booking.status === 'confirmed') {
      void notificationsService.onBookingConfirmed(booking.id).catch(() => {
        // Notification scheduling is best-effort when Redis/worker is offline.
      });
    }

    return toBooking(booking);
  }

  async confirmBookingAfterDeposit(bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    if (booking.status === 'confirmed') {
      if (booking.depositStatus !== 'paid') {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: { depositStatus: 'paid', holdExpiresAt: null },
        });
        return toBooking(updated);
      }
      return toBooking(booking);
    }

    if (booking.status !== 'held') {
      throw new ApiError('CONFLICT', 'Booking cannot be confirmed from current status', 409);
    }

    assertBookingTransition(booking.status, 'confirmed');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'confirmed',
        depositStatus: 'paid',
        holdExpiresAt: null,
      },
    });

    void notificationsService.onBookingConfirmed(updated.id).catch(() => {});

    return toBooking(updated);
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

    void notificationsService.onBookingConfirmed(updated.id).catch(() => {});

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

    void notificationsService.onBookingConfirmed(updated.id).catch(() => {});

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

    void notificationsService.onBookingCancelled(updated.id).catch(() => {});

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

    void notificationsService.onBookingNoShow(updated.id).catch(() => {});

    return toBooking(updated);
  }
}

export const bookingService = new BookingService();
