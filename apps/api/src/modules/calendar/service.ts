import type {
  AvailabilityQuery,
  AvailabilityResponse,
  BusinessAvailabilityQuery,
  BusinessAvailabilityResponse,
  SchedulingSettings,
  UpdateSchedulingSettingsRequest,
} from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { profileService } from '../profile/service.js';
import { getBaseAvailabilityRules } from '../stylist-profile/availability.js';
import { expireStaleHolds } from '../booking/conflict.js';
import { generateAvailabilitySlots } from './availability.js';
import { getDateKeyInTimeZone } from '../../lib/scheduling/timezone.js';

export class CalendarService {
  private maxRangeMs(): number {
    return getEnv().AVAILABILITY_MAX_DAYS * 24 * 60 * 60 * 1000;
  }

  private parseDateRange(fromInput?: string, toInput?: string): { from: Date; to: Date } {
    const env = getEnv();
    const from = fromInput ? new Date(fromInput) : new Date();
    const maxRangeMs = this.maxRangeMs();
    const to = toInput ? new Date(toInput) : new Date(from.getTime() + maxRangeMs);

    if (to <= from) {
      throw ApiError.validation('`to` must be after `from`');
    }

    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw ApiError.validation(`Date range cannot exceed ${env.AVAILABILITY_MAX_DAYS} days`);
    }

    return { from, to };
  }

  async resolveBusinessContext(businessId: string): Promise<{
    businessId: string;
    stylistId: string;
  }> {
    const profile = await prisma.stylistProfile.findFirst({
      where: { businessId },
      select: { id: true, businessId: true },
    });
    if (!profile?.businessId) {
      throw ApiError.notFound('Business not found');
    }
    return { businessId: profile.businessId, stylistId: profile.id };
  }

  async getAvailableSlotsForBusiness(
    businessId: string,
    query: BusinessAvailabilityQuery,
  ): Promise<BusinessAvailabilityResponse> {
    const { stylistId } = await this.resolveBusinessContext(businessId);
    const availability = await this.getAvailableSlots({
      stylistId,
      businessId,
      serviceOfferingId: query.serviceOfferingId,
      durationMinutes: query.durationMinutes,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });

    return {
      businessId,
      stylistId: availability.stylistId,
      serviceOfferingId: availability.serviceOfferingId,
      timezone: availability.timezone,
      slots: availability.slots,
    };
  }

  /** Ch.8.1 — core availability computation for booking + receptionist consumers. */
  async getAvailableSlots(input: {
    stylistId: string;
    businessId?: string;
    serviceOfferingId?: string;
    durationMinutes?: number;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<AvailabilityResponse> {
    const env = getEnv();
    const { from, to } = this.parseDateRange(input.from, input.to);

    let durationMinutes = input.durationMinutes;
    let serviceOfferingId: string | null = input.serviceOfferingId ?? null;

    if (input.serviceOfferingId) {
      const offering = await profileService.getActiveServiceOffering(
        input.stylistId,
        input.serviceOfferingId,
      );
      durationMinutes = offering.estimatedDurationMinutes;
      serviceOfferingId = offering.id;
    }

    if (!durationMinutes) {
      throw ApiError.validation('durationMinutes or serviceOfferingId is required');
    }

    const profile = await prisma.stylistProfile.findUnique({
      where: { id: input.stylistId },
      select: { businessId: true, bufferMinutes: true },
    });
    if (!profile) {
      throw ApiError.notFound('Stylist profile not found');
    }

    const businessId = input.businessId ?? profile.businessId;
    if (!businessId) {
      throw ApiError.validation('Business context required for availability');
    }

    const fromKey = getDateKeyInTimeZone(from, env.PLATFORM_TIMEZONE);
    const toKey = getDateKeyInTimeZone(to, env.PLATFORM_TIMEZONE);
    const rules = await getBaseAvailabilityRules(businessId, fromKey, toKey);
    const blockingBookings = await this.getBlockingBookings(input.stylistId, from, to);

    const slots = generateAvailabilitySlots({
      from,
      to,
      timeZone: env.PLATFORM_TIMEZONE,
      dayRules: rules.days,
      durationMinutes,
      bufferMinutes: profile.bufferMinutes,
      slotIntervalMinutes: env.AVAILABILITY_SLOT_INTERVAL_MINUTES,
      blockingBookings,
      limit: input.limit ?? 20,
    });

    return {
      stylistId: input.stylistId,
      serviceOfferingId,
      timezone: env.PLATFORM_TIMEZONE,
      slots,
    };
  }

  async getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
    return this.getAvailableSlots({
      stylistId: query.stylistId,
      serviceOfferingId: query.serviceOfferingId,
      durationMinutes: query.durationMinutes,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
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

  async getSchedulingSettings(businessId: string): Promise<SchedulingSettings> {
    const profile = await prisma.stylistProfile.findFirst({
      where: { businessId },
      select: { businessId: true, bufferMinutes: true, requireStylistApproval: true },
    });
    if (!profile?.businessId) {
      throw ApiError.notFound('Business not found');
    }
    return {
      businessId: profile.businessId,
      bufferMinutes: profile.bufferMinutes,
      requireStylistApproval: profile.requireStylistApproval,
    };
  }

  async updateSchedulingSettings(
    businessId: string,
    input: UpdateSchedulingSettingsRequest,
  ): Promise<SchedulingSettings> {
    const profile = await prisma.stylistProfile.findFirst({
      where: { businessId },
      select: { id: true },
    });
    if (!profile) {
      throw ApiError.notFound('Business not found');
    }

    const updated = await prisma.stylistProfile.update({
      where: { id: profile.id },
      data: {
        ...(input.bufferMinutes !== undefined ? { bufferMinutes: input.bufferMinutes } : {}),
        ...(input.requireStylistApproval !== undefined
          ? { requireStylistApproval: input.requireStylistApproval }
          : {}),
      },
      select: { businessId: true, bufferMinutes: true, requireStylistApproval: true },
    });

    return {
      businessId: updated.businessId!,
      bufferMinutes: updated.bufferMinutes,
      requireStylistApproval: updated.requireStylistApproval,
    };
  }
}

export const calendarService = new CalendarService();
