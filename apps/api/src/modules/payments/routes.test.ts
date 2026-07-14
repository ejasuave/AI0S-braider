import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { setStripeProvider } from '../../lib/stripe/index.js';
import { createMockStripeProvider } from '../../lib/stripe/mock-stripe-provider.js';
import { signAccessToken } from '../identity/tokens.js';
import { DEFAULT_DEPOSIT_POLICY } from '@project-braids/shared-types/api';
import { buildMockStripeWebhookSignature } from './routes.js';
import { ensurePrismaConnection } from '../../test/ensure-prisma-connection.js';

const stylistUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const clientUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const offeringId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

let databaseAvailable = false;
let stylistProfileId = '';
let businessId = '';
const mockStripe = createMockStripeProvider();

async function bearerFor(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  });
  return `Bearer ${token}`;
}

describe('payment routes', () => {
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

  afterEach(async () => {
    if (!databaseAvailable) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await ensurePrismaConnection();
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { booking: { stylistId: stylistProfileId || undefined } },
          { recipientId: { in: [stylistUserId, clientUserId] } },
        ],
      },
    });
    const bookingIds = (
      await prisma.booking.findMany({
        where: { stylistId: stylistProfileId || undefined },
        select: { id: true },
      })
    ).map((booking) => booking.id);
    if (bookingIds.length > 0) {
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    }
    await prisma.booking.deleteMany({
      where: { stylistId: stylistProfileId || undefined },
    });
    await prisma.paymentAccount.deleteMany({ where: { businessId: businessId || undefined } });
    await prisma.business.deleteMany({ where: { ownerUserId: stylistUserId } });
    await prisma.serviceOffering.deleteMany({ where: { id: offeringId } });
    await prisma.stylistProfile.deleteMany({ where: { userId: stylistUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [stylistUserId, clientUserId] } } });
    stylistProfileId = '';
    businessId = '';
  });

  async function seedPaymentFixtures(): Promise<string> {
    await prisma.user.createMany({
      data: [
        {
          id: stylistUserId,
          role: 'stylist_owner',
          phoneNumber: '+447700900501',
          email: 'payment-stylist@example.com',
          phoneVerifiedAt: new Date(),
        },
        {
          id: clientUserId,
          role: 'client',
          phoneNumber: '+447700900502',
          email: null,
          phoneVerifiedAt: new Date(),
        },
      ],
    });

    const business = await prisma.business.create({
      data: { ownerUserId: stylistUserId, businessName: 'Payment Test Salon' },
    });

    const profile = await prisma.stylistProfile.create({
      data: {
        userId: stylistUserId,
        businessId: business.id,
        businessName: 'Payment Test Salon',
        depositPolicy: DEFAULT_DEPOSIT_POLICY,
        onboardingStatus: 'complete',
      },
    });
    stylistProfileId = profile.id;
    businessId = business.id;

    await prisma.serviceOffering.create({
      data: {
        id: offeringId,
        businessId: business.id,
        stylistId: stylistProfileId,
        styleName: 'Box Braids',
        sizeTier: 'Medium',
        lengthTier: 'Shoulder-length',
        basePrice: 120,
        estimatedDurationMinutes: 240,
        active: true,
      },
    });

    const onboarding = await mockStripe.createConnectAccount({ stylistId: stylistProfileId });
    mockStripe.markConnectAccountReady(onboarding.stripeAccountId);
    await prisma.paymentAccount.create({
      data: {
        businessId: business.id,
        stripeConnectAccountId: onboarding.stripeAccountId,
        onboardingStatus: 'complete',
        chargesEnabled: true,
        payoutsEnabled: true,
      },
    });

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0);
    const booking = await prisma.booking.create({
      data: {
        stylistId: stylistProfileId,
        clientId: clientUserId,
        serviceOfferingId: offeringId,
        status: 'held',
        startTime,
        endTime: new Date(startTime.getTime() + 4 * 60 * 60 * 1000),
        agreedPrice: 120,
        agreedDurationMinutes: 240,
        depositAmount: 30,
        depositStatus: 'pending',
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        source: 'client_direct',
      },
    });

    return booking.id;
  }

  it('creates a deposit PaymentIntent for a held booking', async () => {
    if (!databaseAvailable) return;

    const bookingId = await seedPaymentFixtures();
    const app = await buildApp();
    const clientAuth = await bearerFor(clientUserId, 'client');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/deposits',
      headers: { authorization: clientAuth },
      payload: { bookingId },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.bookingId).toBe(bookingId);
    expect(body.data.clientSecret).toContain('secret_mock');
    expect(body.data.amount).toBe('30.00');
  });

  it('confirms booking after mock webhook payment_intent.succeeded', async () => {
    if (!databaseAvailable) return;

    const bookingId = await seedPaymentFixtures();
    const app = await buildApp();
    const clientAuth = await bearerFor(clientUserId, 'client');

    const depositResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/deposits',
      headers: { authorization: clientAuth },
      payload: { bookingId },
    });
    const paymentIntentId = depositResponse.json().data.stripePaymentIntentId;
    const event = mockStripe.buildPaymentIntentSucceededEvent(paymentIntentId);
    const { body, signature } = buildMockStripeWebhookSignature(event);

    const webhookResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: body,
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(webhookResponse.json().data.status).toBe('processed');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('confirmed');
    expect(booking?.depositStatus).toBe('paid');

    const duplicateWebhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: body,
    });
    expect(duplicateWebhook.json().data.status).toBe('duplicate');
  });

  it('simulates deposit success without a prior PaymentIntent (mock mode)', async () => {
    if (!databaseAvailable) return;

    const bookingId = await seedPaymentFixtures();
    const app = await buildApp();
    const clientAuth = await bearerFor(clientUserId, 'client');

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/deposits/${bookingId}/simulate-success`,
      headers: { authorization: clientAuth },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('captured');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('confirmed');
    expect(booking?.depositStatus).toBe('paid');
  });

  it('syncs deposit after client checkout without webhook', async () => {
    if (!databaseAvailable) return;

    const bookingId = await seedPaymentFixtures();
    const app = await buildApp();
    const clientAuth = await bearerFor(clientUserId, 'client');

    const depositResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/deposits',
      headers: { authorization: clientAuth },
      payload: { bookingId },
    });
    const paymentIntentId = depositResponse.json().data.stripePaymentIntentId;
    mockStripe.buildPaymentIntentSucceededEvent(paymentIntentId);

    const syncResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/deposits/${bookingId}/sync`,
      headers: { authorization: clientAuth },
      payload: {},
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.json().data.bookingConfirmed).toBe(true);
    expect(syncResponse.json().data.payment.status).toBe('captured');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('confirmed');
    expect(booking?.depositStatus).toBe('paid');
  });

  it('returns connect status for onboarded stylist', async () => {
    if (!databaseAvailable) return;

    await seedPaymentFixtures();
    const app = await buildApp();
    const stylistAuth = await bearerFor(stylistUserId, 'stylist_owner');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/connect/status',
      headers: { authorization: stylistAuth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.connected).toBe(true);
  });
});
