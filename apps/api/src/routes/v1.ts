import type { FastifyPluginAsync } from 'fastify';
import { paginationParamsSchema } from '@project-braids/shared-types/api';
import { ApiError } from '../lib/errors.js';
import { sendData } from '../lib/http.js';
import { systemRoutes } from '../modules/system/routes.js';
import { webhookRoutes } from '../modules/webhooks/routes.js';
import { identityRoutes } from '../modules/identity/routes.js';
import { accessRoutes } from '../modules/identity/access.routes.js';
import { profileRoutes } from '../modules/profile/routes.js';
import { profileUploadRoutes } from '../modules/profile/upload.routes.js';
import { bookingRoutes } from '../modules/booking/routes.js';
import { paymentRoutes, stripeWebhookRoutes } from '../modules/payments/routes.js';
import { messagingRoutes } from '../modules/messaging/routes.js';
import { directoryRoutes } from '../modules/directory/routes.js';
import { twilioWebhookRoutes } from '../modules/messaging/twilio-webhook.js';

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(identityRoutes, { prefix: '/auth' });
  await app.register(accessRoutes, { prefix: '/access' });
  await app.register(profileRoutes, { prefix: '/profile' });
  await app.register(profileUploadRoutes, { prefix: '/profile' });
  await app.register(bookingRoutes, { prefix: '/bookings' });
  await app.register(paymentRoutes, { prefix: '/payments' });
  await app.register(messagingRoutes, { prefix: '/messaging' });
  await app.register(directoryRoutes, { prefix: '/directory' });
  await app.register(systemRoutes, { prefix: '/system' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(stripeWebhookRoutes, { prefix: '/webhooks' });
  await app.register(twilioWebhookRoutes, { prefix: '/webhooks' });

  app.get('/ping', async (request, reply) => {
    const parsed = paginationParamsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw ApiError.validation('Invalid pagination query', parsed.error.flatten());
    }

    sendData(reply, {
      pong: true,
      timestamp: new Date().toISOString(),
      service: 'api',
      meta: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      },
    });
  });
};
