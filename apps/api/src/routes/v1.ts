import type { FastifyPluginAsync } from 'fastify';
import { systemRoutes } from '../modules/system/routes.js';
import { webhookRoutes } from '../modules/webhooks/routes.js';
import { identityRoutes } from '../modules/identity/routes.js';
import { accessRoutes } from '../modules/identity/access.routes.js';
import { profileRoutes } from '../modules/profile/routes.js';
import { bookingRoutes } from '../modules/booking/routes.js';

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(identityRoutes, { prefix: '/auth' });
  await app.register(accessRoutes, { prefix: '/access' });
  await app.register(profileRoutes, { prefix: '/profile' });
  await app.register(bookingRoutes, { prefix: '/bookings' });
  await app.register(systemRoutes, { prefix: '/system' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });

  app.get('/ping', async (_request, reply) => {
    void reply.send({
      data: {
        pong: true,
        timestamp: new Date().toISOString(),
        service: 'api',
      },
    });
  });
};
