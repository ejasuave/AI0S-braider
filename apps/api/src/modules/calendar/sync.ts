import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { encryptAtRest, decryptAtRest } from '../../lib/security/encryption.js';
import { calendarConflictService } from '../booking/calendar-conflicts.js';
import { intervalsOverlap } from '../booking/conflict.js';
import { getGoogleCalendarApiClient, isGoogleCalendarMockMode } from './google-client.js';

function encryptionSecret(): string {
  return getEnv().JWT_SECRET;
}

export class CalendarSyncService {
  private async getConnection(businessId: string) {
    return prisma.calendarConnection.findUnique({ where: { businessId } });
  }

  private async getAccessToken(connection: {
    businessId: string;
    refreshTokenEnc: string;
    accessTokenEnc: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    if (
      connection.accessTokenEnc &&
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return decryptAtRest(connection.accessTokenEnc, encryptionSecret());
    }

    const refreshToken = decryptAtRest(connection.refreshTokenEnc, encryptionSecret());
    const token = await getGoogleCalendarApiClient().refreshAccessToken(refreshToken);

    await prisma.calendarConnection.update({
      where: { businessId: connection.businessId },
      data: {
        accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
        tokenExpiresAt: token.expiresAt,
      },
    });

    return token.accessToken;
  }

  async getConnectionStatus(businessId: string) {
    const mockMode = isGoogleCalendarMockMode();
    const connection = await this.getConnection(businessId);
    if (!connection) {
      return {
        connected: false,
        provider: null,
        calendarId: null,
        subscriptionExpiresAt: null,
        mockMode,
      };
    }

    return {
      connected: true,
      provider: 'google' as const,
      calendarId: connection.calendarId,
      subscriptionExpiresAt: connection.subscriptionExpiresAt?.toISOString() ?? null,
      mockMode,
    };
  }

  async connectGoogleCalendar(input: {
    businessId: string;
    code: string;
    redirectUri: string;
  }): Promise<{ connected: true }> {
    let token;
    try {
      token = await getGoogleCalendarApiClient().exchangeCode({
        code: input.code,
        redirectUri: input.redirectUri,
      });
    } catch (err) {
      // OAuth codes are single-use. A duplicate connect (e.g. React Strict Mode) may fail
      // after the first request already persisted tokens.
      const existing = await this.getConnection(input.businessId);
      if (existing) {
        return { connected: true };
      }
      throw err;
    }

    const env = getEnv();
    const accessToken = token.accessToken;

    // Push webhooks require a publicly reachable HTTPS URL. Localhost fails — still
    // save the connection so create/delete sync works; reconcile job covers inbound.
    let channelId: string | null = null;
    let channelResourceId: string | null = null;
    let subscriptionExpiresAt: Date | null = null;
    try {
      const watchId = randomUUID();
      const watch = await getGoogleCalendarApiClient().watchCalendar({
        accessToken,
        calendarId: 'primary',
        webhookUrl: `${env.API_PUBLIC_URL}/api/v1/webhooks/google/calendar`,
        channelId: watchId,
        channelToken: env.GOOGLE_CALENDAR_WEBHOOK_SECRET ?? 'dev-calendar-webhook',
      });
      channelId = watch.channelId;
      channelResourceId = watch.resourceId;
      subscriptionExpiresAt = watch.expiration;
    } catch {
      // Best-effort — outbound push still works without a watch channel.
    }

    await prisma.calendarConnection.upsert({
      where: { businessId: input.businessId },
      create: {
        businessId: input.businessId,
        refreshTokenEnc: encryptAtRest(token.refreshToken, encryptionSecret()),
        accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
        tokenExpiresAt: token.expiresAt,
        channelId,
        channelResourceId,
        subscriptionExpiresAt,
      },
      update: {
        refreshTokenEnc: encryptAtRest(token.refreshToken, encryptionSecret()),
        accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
        tokenExpiresAt: token.expiresAt,
        channelId,
        channelResourceId,
        subscriptionExpiresAt,
      },
    });

    return { connected: true };
  }

  async disconnectGoogleCalendar(businessId: string): Promise<void> {
    const connection = await this.getConnection(businessId);
    if (!connection) {
      return;
    }

    try {
      const accessToken = await this.getAccessToken(connection);
      if (connection.channelId && connection.channelResourceId) {
        await getGoogleCalendarApiClient().stopChannel({
          accessToken,
          channelId: connection.channelId,
          resourceId: connection.channelResourceId,
        });
      }
    } catch {
      // Best-effort stop on disconnect.
    }

    await prisma.calendarConnection.delete({ where: { businessId } });
  }

  /** Ch.8.2 — push confirmed platform booking to Google Calendar. */
  async pushToExternalCalendar(bookingId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking || booking.status !== 'confirmed') {
      return;
    }

    const stylist = await prisma.stylistProfile.findUnique({
      where: { id: booking.stylistId },
      select: { businessId: true, businessName: true },
    });
    if (!stylist?.businessId) {
      return;
    }

    const businessId = stylist.businessId;
    const connection = await this.getConnection(businessId);
    if (!connection) {
      return;
    }

    const accessToken = await this.getAccessToken(connection);
    const summary = `${stylist.businessName} booking`;
    const event = await getGoogleCalendarApiClient().createEvent({
      accessToken,
      calendarId: connection.calendarId,
      summary,
      start: booking.startTime.toISOString(),
      end: booking.endTime.toISOString(),
    });

    await prisma.externalCalendarLink.upsert({
      where: {
        businessId_provider_externalEventId: {
          businessId,
          provider: 'google',
          externalEventId: event.id,
        },
      },
      create: {
        businessId,
        provider: 'google',
        externalEventId: event.id,
        bookingId: booking.id,
        syncStatus: 'synced',
      },
      update: {
        bookingId: booking.id,
        syncStatus: 'synced',
      },
    });
  }

  /** Ch.8.2 — remove external event when platform booking is cancelled. */
  async removeExternalCalendarEvent(bookingId: string): Promise<void> {
    const link = await prisma.externalCalendarLink.findFirst({
      where: { bookingId, provider: 'google' },
    });
    if (!link) {
      return;
    }

    const connection = await this.getConnection(link.businessId);
    if (!connection) {
      await prisma.externalCalendarLink.update({
        where: { id: link.id },
        data: { syncStatus: 'failed' },
      });
      return;
    }

    try {
      const accessToken = await this.getAccessToken(connection);
      await getGoogleCalendarApiClient().deleteEvent({
        accessToken,
        calendarId: connection.calendarId,
        eventId: link.externalEventId,
      });
      await prisma.externalCalendarLink.delete({ where: { id: link.id } });
    } catch {
      await prisma.externalCalendarLink.update({
        where: { id: link.id },
        data: { syncStatus: 'failed' },
      });
    }
  }

  async flagUntrackedExternalEvent(input: {
    businessId: string;
    externalEventId: string;
    start: Date;
    end: Date;
  }): Promise<void> {
    const existingLink = await prisma.externalCalendarLink.findFirst({
      where: {
        businessId: input.businessId,
        provider: 'google',
        externalEventId: input.externalEventId,
      },
    });
    if (existingLink) {
      return;
    }

    const stylist = await prisma.stylistProfile.findFirst({
      where: { businessId: input.businessId },
      select: { id: true },
    });
    if (!stylist) {
      return;
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        stylistId: stylist.id,
        status: { in: ['held', 'confirmed'] },
        startTime: { lt: input.end },
        endTime: { gt: input.start },
      },
      select: { id: true, startTime: true, endTime: true },
    });

    if (
      overlapping &&
      intervalsOverlap(input.start, input.end, overlapping.startTime, overlapping.endTime)
    ) {
      await calendarConflictService.flagExternalCalendarConflict({
        businessId: input.businessId,
        externalEventId: input.externalEventId,
        conflictingBookingId: overlapping.id,
      });
      return;
    }

    await calendarConflictService.flagExternalCalendarConflict({
      businessId: input.businessId,
      externalEventId: input.externalEventId,
    });
  }

  async reconcileBusinessCalendar(businessId: string): Promise<{
    flagged: number;
    retriedDeletions: number;
    renewedSubscription: boolean;
  }> {
    const connection = await this.getConnection(businessId);
    if (!connection) {
      return { flagged: 0, retriedDeletions: 0, renewedSubscription: false };
    }

    const env = getEnv();
    const accessToken = await this.getAccessToken(connection);
    const from = new Date();
    const to = new Date(from.getTime() + env.AVAILABILITY_MAX_DAYS * 24 * 60 * 60 * 1000);
    const events = await getGoogleCalendarApiClient().listEvents({
      accessToken,
      calendarId: connection.calendarId,
      from,
      to,
    });

    let flagged = 0;
    for (const event of events) {
      const link = await prisma.externalCalendarLink.findFirst({
        where: {
          businessId,
          provider: 'google',
          externalEventId: event.id,
        },
      });
      if (!link) {
        await this.flagUntrackedExternalEvent({
          businessId,
          externalEventId: event.id,
          start: new Date(event.start),
          end: new Date(event.end),
        });
        flagged += 1;
      }
    }

    let retriedDeletions = 0;
    const staleLinks = await prisma.externalCalendarLink.findMany({
      where: {
        businessId,
        syncStatus: 'failed',
        booking: { status: 'cancelled' },
      },
    });
    for (const link of staleLinks) {
      if (!link.bookingId) continue;
      await this.removeExternalCalendarEvent(link.bookingId);
      retriedDeletions += 1;
    }

    let renewedSubscription = false;
    const renewBefore = Date.now() + 24 * 60 * 60 * 1000;
    if (
      !connection.subscriptionExpiresAt ||
      connection.subscriptionExpiresAt.getTime() <= renewBefore
    ) {
      try {
        const channelId = randomUUID();
        const watch = await getGoogleCalendarApiClient().watchCalendar({
          accessToken,
          calendarId: connection.calendarId,
          webhookUrl: `${env.API_PUBLIC_URL}/api/v1/webhooks/google/calendar`,
          channelId,
          channelToken: env.GOOGLE_CALENDAR_WEBHOOK_SECRET ?? 'dev-calendar-webhook',
        });
        await prisma.calendarConnection.update({
          where: { businessId },
          data: {
            channelId: watch.channelId,
            channelResourceId: watch.resourceId,
            subscriptionExpiresAt: watch.expiration,
          },
        });
        renewedSubscription = true;
      } catch {
        // Webhook renew is best-effort (fails on localhost / unreachable API_PUBLIC_URL).
      }
    }

    return { flagged, retriedDeletions, renewedSubscription };
  }

  async handleInboundNotification(input: {
    channelId: string;
    resourceId: string;
    channelToken?: string;
  }): Promise<void> {
    const env = getEnv();
    const expectedToken = env.GOOGLE_CALENDAR_WEBHOOK_SECRET ?? 'dev-calendar-webhook';
    if (input.channelToken && input.channelToken !== expectedToken) {
      throw ApiError.forbidden('Invalid calendar webhook token');
    }

    const connection = await prisma.calendarConnection.findFirst({
      where: {
        channelId: input.channelId,
        channelResourceId: input.resourceId,
      },
    });
    if (!connection) {
      return;
    }

    await this.reconcileBusinessCalendar(connection.businessId);
  }
}

export const calendarSyncService = new CalendarSyncService();
