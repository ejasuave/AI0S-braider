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
import type { BookingSource, Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { getSystemQueue, JOB_NAMES } from '../../lib/queue.js';
import { profileService } from '../profile/service.js';
import { getBusinessPolicyByStylistId } from '../stylist-profile/policy.js';
import { expireStaleHolds, findConflictingBookingIds } from './conflict.js';
import { calculateBookingEndTime, calculateDepositAmount, toBooking } from './mappers.js';
import { evaluateCancellationDeposit, evaluateNoShowDeposit } from './policy.js';
import { transitionBookingStatus } from './state-machine.js';
import { slotMatchesAvailability } from '../calendar/availability.js';
import { calendarService } from '../calendar/service.js';
import { pushToExternalCalendar, removeExternalCalendarEvent } from './external-calendar.js';
import {
  emitBookingCancelled,
  emitBookingConfirmed,
  emitBookingCreated,
  emitBookingDepositDisposition,
  emitBookingNoShow,
} from '../../lib/domain-events.js';
import { isPaymentReady } from '../payments/readiness.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger().child({ module: 'booking' });

function pushCalendarSafely(bookingId: string): void {
  void pushToExternalCalendar(bookingId).catch((error: unknown) => {
    log.warn({ err: error, bookingId }, 'Google Calendar push failed');
  });
}

function removeCalendarSafely(bookingId: string): void {
  void removeExternalCalendarEvent(bookingId).catch((error: unknown) => {
    log.warn({ err: error, bookingId }, 'Google Calendar delete failed');
  });
}

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
  serviceVenueMode: 'remote' | 'stylist_location' | 'come_to_client';
  venueAddress?: string | null;
  homeVisitSurcharge?: number;
  clientDisplayName?: string | null;
};

async function loadClientPhones(
  clientIds: Array<string | null>,
): Promise<Map<string, string>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, phoneNumber: true },
  });
  return new Map(users.map((u) => [u.id, u.phoneNumber]));
}

async function resolveVenueForStylist(stylistId: string): Promise<{
  serviceVenueMode: 'remote' | 'stylist_location' | 'come_to_client';
  workplaceAddress: string | null;
  homeVisitSurcharge: number | null;
}> {
  const profile = await prisma.stylistProfile.findUnique({
    where: { id: stylistId },
    select: {
      business: {
        select: {
          serviceVenueMode: true,
          workplaceAddress: true,
          homeVisitSurcharge: true,
        },
      },
    },
  });
  if (!profile?.business) {
    return {
      serviceVenueMode: 'stylist_location',
      workplaceAddress: null,
      homeVisitSurcharge: null,
    };
  }
  return {
    serviceVenueMode: profile.business.serviceVenueMode,
    workplaceAddress: profile.business.workplaceAddress,
    homeVisitSurcharge: profile.business.homeVisitSurcharge?.toNumber() ?? null,
  };
}

export class BookingService {
  private holdTtlMs(): number {
    return getEnv().BOOKING_HOLD_TTL_MINUTES * 60_000;
  }

  async listBookings(stylistId: string, query: BookingListQuery): Promise<Booking[]> {
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { requireStylistApproval: true },
    });
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
    const phones = await loadClientPhones(bookings.map((b) => b.clientId));
    return bookings.map((booking) =>
      toBooking(booking, {
        requireStylistApproval: profile?.requireStylistApproval,
        audience: 'stylist',
        clientPhoneNumber: booking.clientId ? (phones.get(booking.clientId) ?? null) : null,
      }),
    );
  }

  async listClientBookings(clientId: string, query: BookingListQuery): Promise<Booking[]> {
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      clientId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.segment === 'upcoming') {
      where.status = { in: ['held', 'confirmed'] };
      where.OR = [{ startTime: { gte: now } }, { status: 'held' }];
    } else if (query.segment === 'past') {
      where.OR = [
        { status: { in: ['completed', 'no_show'] } },
        { status: 'confirmed', startTime: { lt: now } },
      ];
    } else if (query.segment === 'cancelled') {
      where.status = 'cancelled';
    }

    if (query.from || query.to) {
      where.startTime = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'desc' },
    });
    return bookings.map((booking) => toBooking(booking, { audience: 'client' }));
  }

  async requiresStylistApproval(stylistId: string): Promise<boolean> {
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { requireStylistApproval: true },
    });
    return profile?.requireStylistApproval ?? false;
  }

  async approveBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    if (booking.status !== 'held') {
      throw new ApiError('CONFLICT', 'Only held bookings can be approved', 409);
    }
    if (booking.source !== 'ai_agent') {
      throw new ApiError('CONFLICT', 'Only AI-created holds require stylist approval', 409);
    }
    if (booking.stylistApprovedAt) {
      return toBooking(booking, { requireStylistApproval: true });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { stylistApprovedAt: new Date() },
    });

    if (updated.clientId) {
      const { paymentService } = await import('../payments/service.js');
      const { messagingService } = await import('../messaging/service.js');
      const { getEnv } = await import('../../config/env.js');
      const env = getEnv();
      const payment = await paymentService.createDepositCharge(updated.clientId, updated.id);
      const depositUrl = `${env.WEB_APP_URL}/client/bookings/${updated.id}`;
      const conversation = await messagingService.findOrCreateSmsConversation({
        stylistId: updated.stylistId,
        clientId: updated.clientId,
      });
      await messagingService.sendOutboundMessage({
        conversationId: conversation.id,
        sender: 'system',
        content: `Your booking is approved. Pay your £${payment.amount} deposit here: ${depositUrl}`,
      });
    }

    return toBooking(updated, { requireStylistApproval: true });
  }

  async getBooking(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { requireStylistApproval: true },
    });
    const phones = await loadClientPhones([booking.clientId]);
    return toBooking(booking, {
      requireStylistApproval: profile?.requireStylistApproval,
      audience: 'stylist',
      clientPhoneNumber: booking.clientId ? (phones.get(booking.clientId) ?? null) : null,
    });
  }

  async getBookingForClient(clientId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    return toBooking(booking, { audience: 'client' });
  }

  async createHold(clientId: string, input: CreateBookingHoldRequest): Promise<Booking> {
    const offering = await profileService.getActiveServiceOffering(
      input.stylistId,
      input.serviceOfferingId,
    );
    const venue = await resolveVenueForStylist(input.stylistId);

    if (venue.serviceVenueMode === 'come_to_client') {
      if (!input.clientVisitAddress?.trim()) {
        throw ApiError.validation('Your visit address is required for a home visit');
      }
    }

    let clientDisplayName = input.clientDisplayName?.trim() || null;
    if (clientDisplayName) {
      await prisma.clientProfile.upsert({
        where: { userId: clientId },
        create: { userId: clientId, displayName: clientDisplayName },
        update: { displayName: clientDisplayName },
      });
    } else {
      const profile = await prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { displayName: true },
      });
      clientDisplayName = profile?.displayName ?? null;
    }

    const surcharge =
      venue.serviceVenueMode === 'come_to_client' ? (venue.homeVisitSurcharge ?? 0) : 0;
    const agreedPrice = offering.basePrice.toNumber() + surcharge;

    const venueAddress =
      venue.serviceVenueMode === 'come_to_client'
        ? input.clientVisitAddress!.trim()
        : venue.serviceVenueMode === 'stylist_location'
          ? venue.workplaceAddress
          : null;

    return this.createBookingRecord({
      stylistId: input.stylistId,
      clientId,
      serviceOfferingId: input.serviceOfferingId,
      startTime: new Date(input.startTime),
      durationMinutes: offering.estimatedDurationMinutes,
      agreedPrice,
      source: input.source as BookingSource,
      status: 'held',
      serviceVenueMode: venue.serviceVenueMode,
      venueAddress,
      homeVisitSurcharge: surcharge,
      clientDisplayName,
    });
  }

  async createManualBooking(
    stylistId: string,
    input: CreateManualBookingRequest,
  ): Promise<Booking> {
    let durationMinutes = input.durationMinutes ?? 60;
    let agreedPrice = 0;
    const serviceOfferingId: string | null = input.serviceOfferingId ?? null;
    const venue = await resolveVenueForStylist(stylistId);
    const surcharge =
      venue.serviceVenueMode === 'come_to_client' ? (venue.homeVisitSurcharge ?? 0) : 0;

    if (input.serviceOfferingId) {
      const offering = await profileService.getActiveServiceOffering(
        stylistId,
        input.serviceOfferingId,
      );
      durationMinutes = offering.estimatedDurationMinutes;
      agreedPrice = offering.basePrice.toNumber() + surcharge;
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
      serviceVenueMode: venue.serviceVenueMode,
      venueAddress:
        venue.serviceVenueMode === 'stylist_location' ? venue.workplaceAddress : null,
      homeVisitSurcharge: surcharge,
      clientDisplayName: null,
    });
  }

  async getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
    return calendarService.getAvailability(query);
  }

  private async createBookingRecord(input: CreateBookingInput): Promise<Booking> {
    await expireStaleHolds(prisma, input.stylistId);

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

    if (depositAmount > 0 && input.status === 'held') {
      const profile = await prisma.stylistProfile.findUnique({
        where: { id: input.stylistId },
        select: { businessId: true },
      });
      if (!profile?.businessId || !(await isPaymentReady(profile.businessId))) {
        throw new ApiError(
          'CONFLICT',
          'This stylist cannot accept deposit payments yet — Stripe onboarding incomplete',
          422,
        );
      }
    }

    const policy = await getBusinessPolicyByStylistId(input.stylistId);
    const policySnapshot = {
      depositType: policy.depositType,
      depositValue: policy.depositValue,
      cancellationWindowHours: policy.cancellationWindowHours,
      noShowFeeType: policy.noShowFeeType,
      capturedAt: new Date().toISOString(),
    };

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
          policySnapshot,
          serviceVenueMode: input.serviceVenueMode,
          venueAddress: input.venueAddress ?? null,
          homeVisitSurcharge: input.homeVisitSurcharge ?? 0,
          clientDisplayName: input.clientDisplayName ?? null,
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
      pushCalendarSafely(booking.id);
      void emitBookingConfirmed({ bookingId: booking.id }).catch(() => {});
    }

    void emitBookingCreated({
      bookingId: booking.id,
      stylistId: booking.stylistId,
      status: booking.status,
    }).catch(() => {});

    const profile = await prisma.stylistProfile.findUnique({
      where: { id: input.stylistId },
      select: { requireStylistApproval: true },
    });
    const phones = await loadClientPhones([booking.clientId]);
    return toBooking(booking, {
      requireStylistApproval: profile?.requireStylistApproval,
      audience: 'stylist',
      clientPhoneNumber: booking.clientId ? (phones.get(booking.clientId) ?? null) : null,
    });
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

    pushCalendarSafely(updated.id);
    void emitBookingConfirmed({ bookingId: updated.id }).catch(() => {});

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
      input.reason ?? (cancelledBy === 'client' ? 'cancelled_by_client' : 'cancelled_by_stylist');

    const policy = await getBusinessPolicyByStylistId(booking.stylistId);
    const depositDisposition = evaluateCancellationDeposit(policy, booking, new Date());

    const updated = await prisma.$transaction(async (tx) => {
      return transitionBookingStatus(tx, booking.id, booking.status, 'cancelled', {
        cancelledAt: new Date(),
        cancellationReason: reason,
        holdExpiresAt: null,
      });
    });

    void emitBookingCancelled({ bookingId: updated.id, depositDisposition }).catch(() => {});
    removeCalendarSafely(updated.id);
    void emitBookingDepositDisposition({
      bookingId: updated.id,
      depositDisposition,
    }).catch(() => {});

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

    void emitBookingNoShow({ bookingId: updated.id, depositDisposition }).catch(() => {});
    void emitBookingDepositDisposition({
      bookingId: updated.id,
      depositDisposition,
    }).catch(() => {});

    return {
      booking: toBooking(updated),
      depositDisposition,
    };
  }
}

export const bookingService = new BookingService();
