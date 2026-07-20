import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { resetEnvCache } from '../../config/env.js';
import { resetStripeProvider, setStripeProvider } from '../../lib/stripe/index.js';
import { createMockStripeProvider } from '../../lib/stripe/mock-stripe-provider.js';
import { signAccessToken } from '../identity/tokens.js';
import { DEFAULT_DEPOSIT_POLICY, DEFAULT_WORKING_HOURS } from '@project-braids/shared-types/api';
import { ensurePrismaConnection } from '../../test/ensure-prisma-connection.js';

const mockStripe = createMockStripeProvider();

const stylistUserId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const clientUserId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const offeringId = '12121212-1212-1212-1212-121212121212';

type TestApp = Awaited<ReturnType<typeof buildApp>>;

/** Pick the first client-facing slot that fits the seeded offering duration + buffer. */
async function pickAvailableHoldSlot(app: TestApp): Promise<string> {
  await ensurePrismaConnection();
  const from = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  const stylistAuth = { authorization: await bearerFor(stylistUserId, 'stylist_owner') };
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/bookings/availability?stylistId=${stylistProfileId}&serviceOfferingId=${offeringId}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&limit=20`,
    headers: stylistAuth,
  });
  expect(response.statusCode).toBe(200);
  const slots = response.json().data.slots as { startTime: string }[];
  expect(slots.length).toBeGreaterThan(0);
  return slots[0]!.startTime;
}

let databaseAvailable = false;
let stylistProfileId = '';

async function bearerFor(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  });
  return `Bearer ${token}`;
}

describe('booking routes', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    resetEnvCache();
    resetStripeProvider();
    setStripeProvider(mockStripe);
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    // Domain events (notifications, calendar) are fire-and-forget — let them finish before teardown.
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
    await prisma.booking.deleteMany({
      where: { stylistId: stylistProfileId || undefined },
    });
    await prisma.payment.deleteMany({
      where: { booking: { stylistId: stylistProfileId || undefined } },
    });
    await prisma.paymentAccount.deleteMany({
      where: { business: { ownerUserId: stylistUserId } },
    });
    await prisma.workingHour.deleteMany({
      where: { business: { ownerUserId: stylistUserId } },
    });
    await prisma.serviceOffering.deleteMany({ where: { id: offeringId } });
    await prisma.businessPolicy.deleteMany({
      where: { business: { ownerUserId: stylistUserId } },
    });
    await prisma.business.deleteMany({ where: { ownerUserId: stylistUserId } });
    await prisma.stylistProfile.deleteMany({ where: { userId: stylistUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [stylistUserId, clientUserId] } } });
    stylistProfileId = '';
  });

  async function seedWorkingHours(businessId: string): Promise<void> {
    await prisma.workingHour.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        businessId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '18:00',
      })),
    });
  }

  async function seedBookingFixtures(): Promise<void> {
    const existingProfile = await prisma.stylistProfile.findFirst({
      where: { userId: stylistUserId },
      select: { id: true },
    });
    if (existingProfile) {
      await prisma.booking.deleteMany({ where: { stylistId: existingProfile.id } });
    }
    await prisma.workingHour.deleteMany({ where: { business: { ownerUserId: stylistUserId } } });
    await prisma.serviceOffering.deleteMany({ where: { id: offeringId } });
    await prisma.businessPolicy.deleteMany({
      where: { business: { ownerUserId: stylistUserId } },
    });
    await prisma.stylistProfile.deleteMany({ where: { userId: stylistUserId } });
    await prisma.business.deleteMany({ where: { ownerUserId: stylistUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [stylistUserId, clientUserId] } } });

    await prisma.user.createMany({
      data: [
        {
          id: stylistUserId,
          role: 'stylist_owner',
          phoneNumber: '+447700900401',
          email: 'booking-stylist@example.com',
          phoneVerifiedAt: new Date(),
        },
        {
          id: clientUserId,
          role: 'client',
          phoneNumber: '+447700900402',
          email: null,
          phoneVerifiedAt: new Date(),
        },
      ],
    });

    const business = await prisma.business.create({
      data: { ownerUserId: stylistUserId, businessName: 'Booking Test Salon' },
    });

    await prisma.businessPolicy.create({
      data: {
        businessId: business.id,
        depositType: 'percentage',
        depositValue: 20,
        cancellationWindowHours: 24,
        noShowFeeType: 'forfeit_deposit',
        remainingBalanceMethod: 'cash_or_card',
      },
    });

    const profile = await prisma.stylistProfile.create({
      data: {
        userId: stylistUserId,
        businessId: business.id,
        businessName: 'Booking Test Salon',
        depositPolicy: DEFAULT_DEPOSIT_POLICY,
        workingHours: DEFAULT_WORKING_HOURS,
        onboardingStatus: 'complete',
      },
    });
    stylistProfileId = profile.id;

    await seedWorkingHours(business.id);

    const onboarding = await mockStripe.createConnectAccount({ stylistId: profile.id });
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

    await prisma.serviceOffering.create({
      data: {
        id: offeringId,
        businessId: business.id,
        stylistId: stylistProfileId,
        styleName: 'Knotless Braids',
        sizeTier: 'Medium',
        lengthTier: 'Waist-length',
        basePrice: 150,
        estimatedDurationMinutes: 300,
      },
    });
  }

  it('allows only one concurrent hold for the same slot', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedBookingFixtures();
    const app = await buildApp();
    const clientAuth = { authorization: await bearerFor(clientUserId, 'client') };
    const holdSlot = await pickAvailableHoldSlot(app);
    const payload = {
      stylistId: stylistProfileId,
      serviceOfferingId: offeringId,
      startTime: holdSlot,
      source: 'client_direct',
      acknowledgedPolicies: true,
      acknowledgedRequirements: true,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings/holds',
      headers: clientAuth,
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings/holds',
      headers: clientAuth,
      payload,
    });

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    const successBody = first.statusCode === 201 ? first.json() : second.json();
    expect(successBody.data.status).toBe('held');
    expect(successBody.data.holdExpiresAt).not.toBeNull();

    await app.close();
  });

  it('expires stale holds before creating a new hold', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedBookingFixtures();
    const app = await buildApp();
    const clientAuth = { authorization: await bearerFor(clientUserId, 'client') };

    const holdSlot = await pickAvailableHoldSlot(app);

    await prisma.booking.create({
      data: {
        stylistId: stylistProfileId,
        clientId: clientUserId,
        serviceOfferingId: offeringId,
        status: 'held',
        startTime: new Date(holdSlot),
        endTime: new Date(new Date(holdSlot).getTime() + 5 * 60 * 60 * 1000),
        agreedPrice: 150,
        agreedDurationMinutes: 300,
        depositAmount: 37.5,
        depositStatus: 'pending',
        holdExpiresAt: new Date(Date.now() - 60_000),
        source: 'client_direct',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings/holds',
      headers: clientAuth,
      payload: {
        stylistId: stylistProfileId,
        serviceOfferingId: offeringId,
        startTime: holdSlot,
        acknowledgedPolicies: true,
        acknowledgedRequirements: true,
      },
    });

    expect(response.statusCode).toBe(201);

    const expired = await prisma.booking.findFirst({
      where: {
        stylistId: stylistProfileId,
        cancellationReason: 'hold_expired',
      },
    });
    expect(expired).not.toBeNull();

    await app.close();
  });

  it('creates, confirms, and completes a manual booking', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedBookingFixtures();
    const app = await buildApp();
    const stylistAuth = { authorization: await bearerFor(stylistUserId, 'stylist_owner') };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings/manual',
      headers: stylistAuth,
      payload: {
        clientId: clientUserId,
        serviceOfferingId: offeringId,
        startTime: '2026-08-01T10:00:00.000Z',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().data.status).toBe('confirmed');
    expect(createResponse.json().data.holdExpiresAt).toBeNull();

    const bookingId = createResponse.json().data.id;

    const completeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/complete`,
      headers: stylistAuth,
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().data.status).toBe('completed');

    // Confirmed bookings enqueue notifications/calendar sync asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await app.close();
  });
});
