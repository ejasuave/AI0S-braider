import type { FastifyPluginAsync } from 'fastify';
import { sendData } from '../../lib/http.js';
import {
  requireAdmin,
  requireAuthenticated,
  requireClient,
  requireStylist,
  requireStylistTenant,
} from './guards.js';
import type { AuthenticatedRequest } from './middleware.js';

/**
 * Guard verification endpoints (Ch.4.2). Production feature routes use the same guards.
 */
export const accessRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/admin',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      sendData(reply, {
        role: auth.user.role,
        stylistId: auth.stylistId,
        scope: 'platform_admin',
      });
    },
  );

  app.get(
    '/stylist',
    { preHandler: [requireStylist, requireStylistTenant] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      sendData(reply, {
        role: auth.user.role,
        stylistId: auth.stylistId,
        scope: 'stylist_tenant',
      });
    },
  );

  app.get(
    '/client',
    { preHandler: [requireClient] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      sendData(reply, {
        role: auth.user.role,
        stylistId: auth.stylistId,
        scope: 'client_self',
      });
    },
  );

  app.get(
    '/authenticated',
    { preHandler: [requireAuthenticated] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      sendData(reply, {
        role: auth.user.role,
        stylistId: auth.stylistId,
        scope: 'any_authenticated',
      });
    },
  );
};
