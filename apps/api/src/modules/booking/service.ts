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
import { getBusinessPolicyByStylistId, resolveDepositPolicy } from '../stylist-profile/policy.js';
import { parseRequirements, requirementTexts } from '../stylist-profile/requirements.js';
import { expireStaleHolds, findConflictingBookingIds } from './conflict.js';
import {
  calculateBalanceAmount,
  calculateBookingEndTime,
  calculateDepositAmount,
  toBooking,
} from './mappers.js';
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
  addonsSnapshot?: Array<{
    serviceAddonId: string;
    name: string;
    description: string | null;
    price: string;
  }>;
  depositPolicyOverride?: { type: 'flat' | 'percent'; value: number } | null;
  remainingBalanceMethod?:
    | 'cash'
    | 'card'
    | 'bank_transfer'
    | 'cash_or_card'
    | 'cash_or_bank_transfer'
    | 'card_or_bank_transfer'
    | 'any'
    | null;
  requirementsAcknowledgedAt?: Date | null;
  policiesAcknowledgedAt?: Date | null;
};

async function loadClientPhones(clientIds: Array<string | null>): Promise<Map<string, string>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, phoneNumber: true },
  });
  return new Map(users.map((u) => [u.id, u.phoneNumber]));
}

/** Resolve stylist business name + style/tier labels for client booking history. */
async function loadClientBookingLabels(
  bookings: Array<{ id: string; stylistId: string; serviceOfferingId: string | null }>,
): Promise<
  Map<
    string,
    {
      stylistBusinessName: string | null;
      serviceStyleName: string | null;
      serviceSizeTier: string | null;
      serviceLengthTier: string | null;
      serviceCategoryName: string | null;
    }
  >
> {
  const stylistIds = [...new Set(bookings.map((b) => b.stylistId))];
  const serviceIds = [
    ...new Set(bookings.map((b) => b.serviceOfferingId).filter((id): id is string => Boolean(id))),
  ];

  const [stylists, offerings] = await Promise.all([
    stylistIds.length === 0
      ? Promise.resolve([])
      : prisma.stylistProfile.findMany({
          where: { id: { in: stylistIds } },
          select: { id: true, businessName: true },
        }),
    serviceIds.length === 0
      ? Promise.resolve([])
      : prisma.serviceOffering.findMany({
          where: { id: { in: serviceIds } },
          select: {
            id: true,
            styleName: true,
            sizeTier: true,
            lengthTier: true,
            styleCategory: { select: { name: true, parent: { select: { name: true } } } },
          },
        }),
  ]);

  const stylistNames = new Map(stylists.map((row) => [row.id, row.businessName]));
  const offeringMeta = new Map(
    offerings.map((row) => [
      row.id,
      {
        styleName: row.styleName,
        sizeTier: row.sizeTier,
        lengthTier: row.lengthTier,
        categoryName: row.styleCategory
          ? row.styleCategory.parent
            ? `${row.styleCategory.parent.name} · ${row.styleCategory.name}`
            : row.styleCategory.name
          : null,
      },
    ]),
  );
  const labels = new Map<
    string,
    {
      stylistBusinessName: string | null;
      serviceStyleName: string | null;
      serviceSizeTier: string | null;
      serviceLengthTier: string | null;
      serviceCategoryName: string | null;
    }
  >();

  for (const booking of bookings) {
    const meta = booking.serviceOfferingId
      ? offeringMeta.get(booking.serviceOfferingId)
      : undefined;
    labels.set(booking.id, {
      stylistBusinessName: stylistNames.get(booking.stylistId) ?? null,
      serviceStyleName: meta?.styleName ?? null,
      serviceSizeTier: meta?.sizeTier ?? null,
      serviceLengthTier: meta?.lengthTier ?? null,
      serviceCategoryName: meta?.categoryName ?? null,
    });
  }
  return labels;
}

async function resolveVenueOffersForStylist(stylistId: string): Promise<{
  offeredModes: Array<'remote' | 'stylist_location' | 'come_to_client'>;
  workplaceAddress: string | null;
  homeVisitSurcharge: number | null;
}> {
  const profile = await prisma.stylistProfile.findUnique({
    where: { id: stylistId },
    select: {
      business: {
        select: {
          offersStylistLocation: true,
          offersComeToClient: true,
          offersRemote: true,
          workplaceAddress: true,
          homeVisitSurcharge: true,
        },
      },
    },
  });
  if (!profile?.business) {
    return {
      offeredModes: ['stylist_location'],
      workplaceAddress: null,
      homeVisitSurcharge: null,
    };
  }
  const offeredModes: Array<'remote' | 'stylist_location' | 'come_to_client'> = [];
  if (profile.business.offersStylistLocation) offeredModes.push('stylist_location');
  if (profile.business.offersComeToClient) offeredModes.push('come_to_client');
  if (profile.business.offersRemote) offeredModes.push('remote');
  if (offeredModes.length === 0) offeredModes.push('stylist_location');
  return {
    offeredModes,
    workplaceAddress: profile.business.workplaceAddress,
    homeVisitSurcharge: profile.business.homeVisitSurcharge?.toNumber() ?? null,
  };
}

function pickDefaultVenueMode(
  offered: Array<'remote' | 'stylist_location' | 'come_to_client'>,
): 'remote' | 'stylist_location' | 'come_to_client' {
  if (offered.includes('stylist_location')) return 'stylist_location';
  if (offered.includes('remote')) return 'remote';
  return offered[0] ?? 'stylist_location';
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
    const labels = await loadClientBookingLabels(bookings);
    return bookings.map((booking) => {
      const label = labels.get(booking.id);
      return toBooking(booking, {
        audience: 'client',
        stylistBusinessName: label?.stylistBusinessName ?? null,
        serviceStyleName: label?.serviceStyleName ?? null,
        serviceSizeTier: label?.serviceSizeTier ?? null,
        serviceLengthTier: label?.serviceLengthTier ?? null,
        serviceCategoryName: label?.serviceCategoryName ?? null,
      });
    });
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
    const labels = await loadClientBookingLabels([booking]);
    const label = labels.get(booking.id);
    return toBooking(booking, {
      audience: 'client',
      stylistBusinessName: label?.stylistBusinessName ?? null,
      serviceStyleName: label?.serviceStyleName ?? null,
      serviceSizeTier: label?.serviceSizeTier ?? null,
      serviceLengthTier: label?.serviceLengthTier ?? null,
      serviceCategoryName: label?.serviceCategoryName ?? null,
    });
  }

  async createHold(clientId: string, input: CreateBookingHoldRequest): Promise<Booking> {
    const offering = await profileService.getActiveServiceOffering(
      input.stylistId,
      input.serviceOfferingId,
    );
    const venue = await resolveVenueOffersForStylist(input.stylistId);
    const businessPolicy = await getBusinessPolicyByStylistId(input.stylistId);

    const requirements = requirementTexts(parseRequirements(offering.requirements));

    if (input.source !== 'ai_agent') {
      if (!input.acknowledgedPolicies) {
        throw ApiError.validation('You must accept the stylist policies to continue');
      }
      if (requirements.length > 0 && !input.acknowledgedRequirements) {
        throw ApiError.validation('You must acknowledge the service requirements to continue');
      }
    }

    const chosenMode =
      input.serviceVenueMode ??
      (venue.offeredModes.length === 1 ? venue.offeredModes[0] : undefined);

    if (!chosenMode) {
      throw ApiError.validation('Choose where this appointment should take place');
    }
    if (!venue.offeredModes.includes(chosenMode)) {
      throw ApiError.validation('That venue option is not offered by this stylist');
    }

    if (chosenMode === 'come_to_client') {
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

    const selectedAddonIds = [...new Set(input.addonIds ?? [])];
    let addonsSnapshot: Array<{
      serviceAddonId: string;
      name: string;
      description: string | null;
      price: string;
    }> = [];
    let addonsTotal = 0;

    if (selectedAddonIds.length > 0) {
      const addons = await prisma.serviceAddon.findMany({
        where: {
          id: { in: selectedAddonIds },
          serviceOfferingId: offering.id,
          active: true,
        },
      });
      if (addons.length !== selectedAddonIds.length) {
        throw ApiError.validation('One or more selected add-ons are unavailable');
      }
      addonsSnapshot = addons
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((addon) => ({
          serviceAddonId: addon.id,
          name: addon.name,
          description: addon.description,
          price: addon.price.toFixed(2),
        }));
      addonsTotal = addons.reduce((sum, addon) => sum + addon.price.toNumber(), 0);
    }

    const surcharge = chosenMode === 'come_to_client' ? (venue.homeVisitSurcharge ?? 0) : 0;
    const agreedPrice =
      Math.round((offering.basePrice.toNumber() + surcharge + addonsTotal) * 100) / 100;

    const depositPolicyOverride = resolveDepositPolicy({
      serviceDepositType: offering.depositType,
      serviceDepositValue: offering.depositValue?.toNumber() ?? null,
      businessPolicy,
    });

    const venueAddress =
      chosenMode === 'come_to_client'
        ? input.clientVisitAddress!.trim()
        : chosenMode === 'stylist_location'
          ? venue.workplaceAddress
          : null;

    const now = new Date();
    return this.createBookingRecord({
      stylistId: input.stylistId,
      clientId,
      serviceOfferingId: input.serviceOfferingId,
      startTime: new Date(input.startTime),
      durationMinutes: offering.estimatedDurationMinutes,
      agreedPrice,
      source: input.source as BookingSource,
      status: 'held',
      serviceVenueMode: chosenMode,
      venueAddress,
      homeVisitSurcharge: surcharge,
      clientDisplayName,
      addonsSnapshot,
      depositPolicyOverride,
      remainingBalanceMethod: businessPolicy.remainingBalanceMethod,
      requirementsAcknowledgedAt:
        requirements.length > 0 && (input.acknowledgedRequirements || input.source === 'ai_agent')
          ? now
          : null,
      policiesAcknowledgedAt:
        input.acknowledgedPolicies || input.source === 'ai_agent' ? now : null,
    });
  }

  async createManualBooking(
    stylistId: string,
    input: CreateManualBookingRequest,
  ): Promise<Booking> {
    let durationMinutes = input.durationMinutes ?? 60;
    let agreedPrice = 0;
    const serviceOfferingId: string | null = input.serviceOfferingId ?? null;
    const venue = await resolveVenueOffersForStylist(stylistId);
    const chosenMode = pickDefaultVenueMode(venue.offeredModes);

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
      serviceVenueMode: chosenMode,
      venueAddress: chosenMode === 'stylist_location' ? venue.workplaceAddress : null,
      homeVisitSurcharge: 0,
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
        ? calculateDepositAmount(
            input.agreedPrice,
            input.depositPolicyOverride ?? scheduling.depositPolicy,
          )
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
      remainingBalanceMethod: policy.remainingBalanceMethod,
      serviceDepositOverride: input.depositPolicyOverride ?? null,
      cancellationPolicyText: policy.cancellationPolicyText,
      reschedulingPolicyText: policy.reschedulingPolicyText,
      lateArrivalPolicyText: policy.lateArrivalPolicyText,
      noShowPolicyText: policy.noShowPolicyText,
      refundPolicyText: policy.refundPolicyText,
      childrenPolicyText: policy.childrenPolicyText,
      guestPolicyText: policy.guestPolicyText,
      depositPolicyText: policy.depositPolicyText,
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
          addonsSnapshot: input.addonsSnapshot ?? [],
          remainingBalanceMethod: input.remainingBalanceMethod ?? policy.remainingBalanceMethod,
          requirementsAcknowledgedAt: input.requirementsAcknowledgedAt ?? null,
          policiesAcknowledgedAt: input.policiesAcknowledgedAt ?? null,
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

    const balanceFields = (() => {
      const remaining = calculateBalanceAmount(
        Number(booking.agreedPrice),
        Number(booking.depositAmount),
      );
      return {
        depositStatus: 'paid' as const,
        holdExpiresAt: null,
        balanceStatus: remaining > 0 ? ('due' as const) : ('not_due' as const),
      };
    })();

    if (booking.status === 'confirmed') {
      if (booking.depositStatus !== 'paid') {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: balanceFields,
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
      const row = await transitionBookingStatus(tx, booking.id, 'held', 'confirmed', balanceFields);
      return row;
    });

    pushCalendarSafely(updated.id);
    void emitBookingConfirmed({ bookingId: updated.id }).catch(() => {});

    return { outcome: 'confirmed', booking: toBooking(updated) };
  }

  async markBalancePaidInPerson(stylistId: string, bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, stylistId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new ApiError('CONFLICT', 'Balance can only be marked paid for confirmed bookings', 409);
    }
    if (booking.depositStatus !== 'paid') {
      throw new ApiError('CONFLICT', 'Deposit must be paid before settling the balance', 409);
    }
    if (booking.balanceStatus === 'paid_online' || booking.balanceStatus === 'paid_in_person') {
      return toBooking(booking);
    }
    const remaining = calculateBalanceAmount(
      Number(booking.agreedPrice),
      Number(booking.depositAmount),
    );
    if (remaining <= 0) {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { balanceStatus: 'not_due' },
      });
      return toBooking(updated);
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        balanceStatus: 'paid_in_person',
        balancePaidAt: new Date(),
      },
    });
    return toBooking(updated);
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
    // Stylist-initiated cancel always refunds the client; client cancel uses policy window.
    const depositDisposition =
      cancelledBy === 'stylist'
        ? 'full_refund'
        : evaluateCancellationDeposit(policy, booking, new Date());

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
