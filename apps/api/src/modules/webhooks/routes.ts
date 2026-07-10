import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { processWebhookIdempotently } from '../../lib/webhooks/idempotent-handler.js';
import { sendData } from '../../lib/http.js';

const exampleWebhookBodySchema = z.object({
  event_id: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Demonstrates the idempotent webhook pattern (Ch.2.6).
   * Real Stripe/Twilio handlers will follow the same sequence in Ch.9/Ch.11.
   */
  app.post('/example', async (request, reply) => {
    const parsed = exampleWebhookBodySchema.safeParse(request.body);
    if (!parsed.success) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook payload',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { event_id: eventId } = parsed.data;

    const outcome = await processWebhookIdempotently({
      eventId,
      source: 'example',
      handler: async () => ({ received: true, eventId }),
    });

    sendData(reply, {
      status: outcome.status,
      eventId,
    });
  });
};
