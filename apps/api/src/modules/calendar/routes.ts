import type { FastifyPluginAsync } from 'fastify';
import {
  businessAvailabilityQuerySchema,
  connectGoogleCalendarRequestSchema,
  updateSchedulingSettingsRequestSchema,
} from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { requireBusinessPermission } from '../roles/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { calendarService } from './service.js';
import { calendarSyncService } from './sync.js';

function resolveBusinessId(request: AuthenticatedRequest): string {
  const businessId = request.auth.businessId;
  if (!businessId) {
    throw ApiError.forbidden('Business context required');
  }
  return businessId;
}

export const calendarBusinessRoutes: FastifyPluginAsync = async (app) => {
  /** Ch.8.1 — public availability for clients and AI receptionist. */
  app.get('/:businessId/availability', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const query = businessAvailabilityQuerySchema.parse(request.query);
    const availability = await calendarService.getAvailableSlotsForBusiness(businessId, query);
    sendData(reply, availability);
  });

  app.get(
    '/me/scheduling',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const settings = await calendarService.getSchedulingSettings(businessId);
      sendData(reply, settings);
    },
  );

  app.patch(
    '/me/scheduling',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const body = updateSchedulingSettingsRequestSchema.parse(request.body);
      const settings = await calendarService.updateSchedulingSettings(businessId, body);
      sendData(reply, settings);
    },
  );

  app.get(
    '/me/calendar/status',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const status = await calendarSyncService.getConnectionStatus(businessId);
      sendData(reply, status);
    },
  );

  app.post(
    '/me/calendar/google/connect',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      const body = connectGoogleCalendarRequestSchema.parse(request.body);
      const result = await calendarSyncService.connectGoogleCalendar({
        businessId,
        code: body.code,
        redirectUri: body.redirectUri,
      });
      sendData(reply, result);
    },
  );

  app.delete(
    '/me/calendar/google',
    { preHandler: [requireBusinessPermission('can_manage_bookings')] },
    async (request, reply) => {
      const auth = request as AuthenticatedRequest;
      const businessId = resolveBusinessId(auth);
      await calendarSyncService.disconnectGoogleCalendar(businessId);
      sendData(reply, { disconnected: true });
    },
  );
};

export const googleCalendarWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/google/calendar', async (request, reply) => {
    const headers = request.headers;
    const channelId = headers['x-goog-channel-id'] as string | undefined;
    const resourceId = headers['x-goog-resource-id'] as string | undefined;
    const channelToken = headers['x-goog-channel-token'] as string | undefined;

    if (!channelId || !resourceId) {
      reply.status(204).send();
      return;
    }

    const eventId = `google-cal-${channelId}-${resourceId}-${headers['x-goog-message-number'] ?? '0'}`;
    const { processWebhookIdempotently } = await import('../../lib/webhooks/idempotent-handler.js');

    await processWebhookIdempotently({
      eventId,
      source: 'google_calendar',
      handler: async () => {
        await calendarSyncService.handleInboundNotification({
          channelId,
          resourceId,
          channelToken,
        });
      },
    });

    reply.status(204).send();
  });
};
