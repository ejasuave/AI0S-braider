import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { setStripeProvider } from '../../lib/stripe/index.js';
import { createMockStripeProvider } from '../../lib/stripe/mock-stripe-provider.js';
import { buildMockStripeWebhookSignature } from './routes.js';

const mockStripe = createMockStripeProvider();
let databaseAvailable = false;

describe('stripe webhook hardening', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  beforeEach(() => {
    setStripeProvider(mockStripe);
  });

  it('rejects invalid webhook signatures', async () => {
    const app = await buildApp();
    const body = JSON.stringify({
      id: 'evt_mock_invalid_sig',
      type: 'account.updated',
      data: { object: { id: 'acct_mock_sig' } },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid_signature',
      },
      payload: body,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('short-circuits replayed event IDs', async ({ skip }) => {
    if (!databaseAvailable) skip();

    const app = await buildApp();
    const event = mockStripe.buildAccountUpdatedEvent('acct_mock_replay');
    const { body, signature } = buildMockStripeWebhookSignature(event);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: body,
    });
    expect(first.json().data.status).toBe('processed');

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: body,
    });
    expect(second.json().data.status).toBe('duplicate');
    await app.close();
  });
});
