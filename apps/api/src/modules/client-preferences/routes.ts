import type { FastifyPluginAsync } from 'fastify';
import {
  saveStylistRequestSchema,
  updateClientProfileRequestSchema,
  updateNotificationPreferencesRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { requireClient } from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { clientPreferencesService } from './service.js';

export const clientPreferencesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const profile = await clientPreferencesService.getProfile(auth.user.id);
    sendData(reply, profile);
  });

  app.patch('/me', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = updateClientProfileRequestSchema.parse(request.body);
    const profile = await clientPreferencesService.updateProfile(auth.user.id, body);
    sendData(reply, profile);
  });

  app.get('/me/saved-stylists', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const stylists = await clientPreferencesService.listSavedStylists(auth.user.id);
    sendData(reply, stylists);
  });

  app.post('/me/saved-stylists', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = saveStylistRequestSchema.parse(request.body);
    const stylists = await clientPreferencesService.saveStylist(auth.user.id, body.stylistId);
    sendData(reply, stylists, 201);
  });

  app.delete(
    '/me/saved-stylists/:stylistId',
    { preHandler: [requireClient] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { stylistId } = request.params as { stylistId: string };
      await clientPreferencesService.removeSavedStylist(auth.user.id, stylistId);
      sendData(reply, { removed: true });
    },
  );

  app.get(
    '/me/notification-preferences',
    { preHandler: [requireClient] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const preferences = await clientPreferencesService.getNotificationPreferences(auth.user.id);
      sendData(reply, preferences);
    },
  );

  app.patch(
    '/me/notification-preferences',
    { preHandler: [requireClient] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const body = updateNotificationPreferencesRequestSchema.parse(request.body);
      const preferences = await clientPreferencesService.updateNotificationPreferences(
        auth.user.id,
        body,
      );
      sendData(reply, preferences);
    },
  );
};
