import type { FastifyPluginAsync } from 'fastify';
import { systemRoutes } from '../modules/system/routes.js';
import { webhookRoutes } from '../modules/webhooks/routes.js';

export const v1Routes: FastifyPluginAsync = async (app) => {
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
