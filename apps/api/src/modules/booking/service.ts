import type {
  AvailabilityQuery,
  AvailabilityResponse,
  Booking,
  BookingActionResult,
  BookingListQuery,
  CancelBookingRequest,
  ConfirmBookingResult,
  CreateBookingHoldRequest,
  CreateManualBookingRequest,
} from '@project-braids/shared-types/api';
import type { BookingSource } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { getSystemQueue, JOB_NAMES } from '../../lib/queue.js';
import { profileService } from '../profile/service.js';
import { getBusinessPolicyByStylistId } from '../stylist-profile/policy.js';
import { notificationsService } from '../notifications/service.js';
import { expireStaleHolds, findConflictingBookingIds } from './conflict.js';
import { calculateBookingEndTime, calculateDepositAmount, toBooking } from './mappers.js';
import { evaluateCancellationDeposit, evaluateNoShowDeposit } from './policy.js';
import { transitionBookingStatus } from './state-machine.js';
import { generateAvailabilitySlots, slotMatchesAvailability } from './availability.js';
import { pushToExternalCalendar } from './external-calendar.js';

type CreateBookingInput = {
  stylistId: string;
  clientId?: string | null;
  serviceOfferingId?: string | null;
  startTime: Date;
  durationMinutes: number;
  agreedPrice: number;
  source: BookingSource;
  status: 'held' | 'confirmed';
  skipAvailabilityCheck?: boolean;
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
    const offering = await profileService.getActiveServiceOffering(
      input.stylistId,
      input.serviceOfferingId,
    );
    return this.createBookingRecord({
      stylistId: input.stylistId,
      clientId,
      serviceOfferingId: input.serviceOfferingId,
      startTime: new Date(input.startTime),
      durationMinutes: offering.estimatedDurationMinutes,
      agreedPrice: offering.basePrice.toNumber(),
      source: input.source as BookingSource,
      status: 'held',
    });
  }

  async createManualBooking(
    stylistId: string,
    input: CreateManualBookingRequest,
  ): Promise<Booking> {
    let durationMinutes = input.durationMinutes ?? 60;
    let agreedPrice = 0;
    const serviceOfferingId: string | null = input.serviceOfferingId ?? null;

    if (input.serviceOfferingId) {
      const offering = await profileService.getActiveServiceOffering(
        stylistId,
        input.serviceOfferingId,
      );
      durationMinutes = offering.estimatedDurationMinutes;
      agreedPrice = offering.basePrice.toNumber();
    }

    return this.createBookingRecord({
      stylistId,
      clientId: input.clientId ?? null,
      serviceOfferingId,
      startTime: new Date(input.startTime),
      durationMinutes,
      agreedPrice,
      source: 'dashboard_manual',
      status: 'confirmed',
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

  private async createBookingRecord(input: CreateBookingInput): Promise<Booking> {
    const scheduling = await profileService.getSchedulingSettings(input.stylistId);
    const startTime = input.startTime;
    const endTime = calculateBookingEndTime(
      startTime,
      input.durationMinutes,
      scheduling.bufferMinutes,
    );

    if (endTime <= startTime) {
      throw ApiError.validation('Invalid booking duration');
    }

    if (!input.skipAvailabilityCheck && input.serviceOfferingId) {
      const availability = await this.getAvailability({
        stylistId: input.stylistId,
        serviceOfferingId: input.serviceOfferingId,
        from: startTime.toISOString(),
        to: new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        limit: 100,
      });
      if (!slotMatchesAvailability(availability.slots, startTime)) {
        throw new ApiError('SLOT_UNAVAILABLE', 'Requested slot is not available', 409);
      }
    }

    const depositAmount =
      input.status === 'held'
        ? calculateDepositAmount(input.agreedPrice, scheduling.depositPolicy)
        : 0;
    const holdExpiresAt = input.status === 'held' ? new Date(Date.now() + this.holdTtlMs()) : null;

    const booking = await prisma.$transaction(async (tx) => {
      await expireStaleHolds(tx, input.stylistId);

      const conflicts = await findConflictingBookingIds(tx, {
        stylistId: input.stylistId,
        startTime,
        endTime,
      });
      if (conflicts.length > 0) {
        throw new ApiError('SLOT_UNAVAILABLE', 'Requested slot is no longer available', 409);
      }

      return tx.booking.create({
        data: {
          stylistId: input.stylistId,
          clientId: input.clientId ?? null,
          serviceOfferingId: input.serviceOfferingId ?? null,
          status: input.status,
          startTime,
          endTime,
          agreedPrice: input.agreedPrice,
          agreedDurationMinutes: input.durationMinutes,
          depositAmount,
          depositStatus: input.status === 'confirmed' ? 'pending' : 'pending',
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
        .catch(() => {});
    }

    if (booking.status === 'confirmed') {
      void pushToExternalCalendar(booking.id).catch(() => {});
      void notificationsService.onBookingConfirmed(booking.id).catch(() => {});
    }

    return toBooking(booking);
  }

  /** Ch.7.3 — documented integration point for Chapter 9 payment webhooks. */
  async confirmBooking(bookingId: string): Promise<ConfirmBookingResult> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    if (booking.status === 'confirmed') {
      if (booking.depositStatus !== 'paid') {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: { depositStatus: 'paid', holdExpiresAt: null },
        });
        return { outcome: 'confirmed', booking: toBooking(updated) };
      }
      return { outcome: 'confirmed', booking: toBooking(booking) };
    }

    if (booking.status !== 'held') {
      throw new ApiError('CONFLICT', 'Booking cannot be confirmed from current status', 409);
    }

    if (booking.holdExpiresAt && booking.holdExpiresAt.getTime() <= Date.now()) {
      return {
        outcome: 'hold_expired',
        booking: toBooking(booking),
        refundRequired: true,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await transitionBookingStatus(tx, booking.id, 'held', 'confirmed', {
        depositStatus: 'paid',
        holdExpiresAt: null,
      });
      return row;
    });

    void pushToExternalCalendar(updated.id).catch(() => {});
    void notificationsService.onBookingConfirmed(updated.id).catch(() => {});

    return { outcome: 'confirmed', booking: toBooking(updated) };
  }

  /** Alias retained for Chapter 9 integration. */
  async confirmBookingAfterDeposit(bookingId: string): Promise<Booking> {
    const result = await this.confirmBooking(bookingId);
    if (result.outcome === 'hold_expired') {
      throw new ApiError('HOLD_EXPIRED', 'Booking hold expired before confirmation', 409, {
        refundRequired: true,
        bookingId,
      });
    }
    return result.booking;
  }

  async confirmBookingAsStylist(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const result = await this.confirmBooking(bookingId);
    if (result.outcome === 'hold_expired') {
      throw new ApiError('HOLD_EXPIRED', 'Booking hold expired', 409);
    }
    return result.booking;
  }

  async cancelBooking(
    actor: { stylistId?: string; clientId?: string },
    bookingId: string,
    input: CancelBookingRequest,
  ): Promise<BookingActionResult> {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        ...(actor.stylistId ? { stylistId: actor.stylistId } : {}),
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const cancelledBy = actor.clientId ? 'client' : 'stylist';
    const reason =
      input.reason ??
      (cancelledBy === 'client' ? 'cancelled_by_client' : 'cancelled_by_stylist');

    const policy = await getBusinessPolicyByStylistId(booking.stylistId);
    const depositDisposition = evaluateCancellationDeposit(policy, booking, new Date());

    const updated = await prisma.$transaction(async (tx) => {
      return transitionBookingStatus(tx, booking.id, booking.status, 'cancelled', {
        cancelledAt: new Date(),
        cancellationReason: reason,
        holdExpiresAt: null,
      });
    });

    void notificationsService.onBookingCancelled(updated.id).catch(() => {});

    return {
      booking: toBooking(updated),
      depositDisposition,
    };
  }

  async completeBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      return transitionBookingStatus(tx, booking.id, 'confirmed', 'completed');
    });

    return toBooking(updated);
  }

  async markNoShow(stylistId: string, bookingId: string): Promise<BookingActionResult> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const policy = await getBusinessPolicyByStylistId(booking.stylistId);
    const depositDisposition = evaluateNoShowDeposit(policy);

    const updated = await prisma.$transaction(async (tx) => {
      return transitionBookingStatus(tx, booking.id, 'confirmed', 'no_show');
    });

    void notificationsService.onBookingNoShow(updated.id).catch(() => {});

    return {
      booking: toBooking(updated),
      depositDisposition,
    };
  }
}

export const bookingService = new BookingService();
