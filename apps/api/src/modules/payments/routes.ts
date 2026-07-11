import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { createDepositPaymentRequestSchema } from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { processWebhookIdempotently } from '../../lib/webhooks/idempotent-handler.js';
import {
  getMockStripeProvider,
  getStripeProvider,
  isStripeMockMode,
} from '../../lib/stripe/index.js';
import { requireClient, requireStylist } from '../identity/guards.js';
import { rejectImpersonationOnSensitiveRoutes } from '../roles/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { paymentService } from './service.js';

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

async function captureRawBody(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: NodeJS.ReadableStream,
): Promise<NodeJS.ReadableStream> {
  const chunks: Buffer[] = [];
  for await (const chunk of payload) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  (request as RawBodyRequest).rawBody = Buffer.concat(chunks);
  return Readable.from((request as RawBodyRequest).rawBody!);
}

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/connect/onboard', {
    preHandler: [requireStylist, rejectImpersonationOnSensitiveRoutes],
  }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const result = await paymentService.startConnectOnboarding(
      auth.stylistId!,
      auth.user.email ?? undefined,
    );
    sendData(reply, result);
  });

  app.get('/connect/status', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const status = await paymentService.getConnectStatus(auth.stylistId!);
    sendData(reply, status);
  });

  app.post('/deposits', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = createDepositPaymentRequestSchema.parse(request.body);
    const payment = await paymentService.createDepositPayment(auth.user.id, body.bookingId);
    sendData(reply, payment, 201);
  });

  app.get('/deposits/:bookingId', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { bookingId } = request.params as { bookingId: string };
    const payment = await paymentService.getPaymentForBooking(auth.user.id, bookingId);
    sendData(reply, payment);
  });

  if (process.env.NODE_ENV !== 'production') {
    app.post(
      '/deposits/:bookingId/simulate-success',
      { preHandler: [requireClient] },
      async (request, reply) => {
        const auth = (request as AuthenticatedRequest).auth;
        const { bookingId } = request.params as { bookingId: string };
        const payment = await paymentService.simulateDepositSuccess(bookingId, auth.user.id);
        sendData(reply, payment);
      },
    );
  }
};

export const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/stripe', { preParsing: captureRawBody }, async (request, reply) => {
    const env = getEnv();
    const rawBody = (request as RawBodyRequest).rawBody;
    if (!rawBody) {
      throw ApiError.validation('Missing webhook body');
    }

    const signature = request.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new ApiError('UNAUTHORIZED', 'Missing Stripe signature', 401);
    }

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret && !isStripeMockMode()) {
      throw ApiError.internal('Stripe webhook secret is not configured');
    }

    let event;
    try {
      event = getStripeProvider().constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret ?? 'mock_webhook_secret',
      );
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Invalid Stripe webhook signature', 401);
    }

    const outcome = await processWebhookIdempotently({
      eventId: event.id,
      source: 'stripe',
      handler: async () => {
        switch (event.type) {
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            const paymentIntentId = String(paymentIntent.id ?? '');
            const bookingId = String(
              (paymentIntent.metadata as Record<string, string> | undefined)?.bookingId ?? '',
            );
            if (!paymentIntentId || !bookingId) {
              throw ApiError.validation('PaymentIntent missing required metadata');
            }
            return paymentService.captureDepositFromWebhook(paymentIntentId, bookingId);
          }
          case 'payment_intent.payment_failed': {
            const paymentIntentId = String(event.data.object.id ?? '');
            if (paymentIntentId) {
              await paymentService.markPaymentFailed(paymentIntentId);
            }
            return { handled: true };
          }
          case 'account.updated': {
            const stripeAccountId = String(event.data.object.id ?? '');
            if (stripeAccountId) {
              await paymentService.syncConnectAccountByStripeId(stripeAccountId, event.data.object);
            }
            return { handled: true };
          }
          default:
            return { handled: false, type: event.type };
        }
      },
    });

    sendData(reply, {
      status: outcome.status,
      eventId: event.id,
      type: event.type,
    });
  });
};

export function buildMockStripeWebhookSignature(
  payload: unknown,
  secret = 'mock_webhook_secret',
): { body: string; signature: string } {
  const mock = getMockStripeProvider();
  if (!mock) {
    throw new Error('Mock Stripe provider is not active');
  }
  const body = JSON.stringify(payload);
  const signature = mock.signWebhookPayload(JSON.parse(body), secret);
  return { body, signature };
}
