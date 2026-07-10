import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from '../identity/tokens.js';
import { DEFAULT_DEPOSIT_POLICY } from '@project-braids/shared-types/api';

const stylistUserId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const clientUserId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const offeringId = '12121212-1212-1212-1212-121212121212';

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

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.booking.deleteMany({
      where: { stylistId: stylistProfileId || undefined },
    });
    await prisma.serviceOffering.deleteMany({ where: { id: offeringId } });
    await prisma.stylistProfile.deleteMany({ where: { userId: stylistUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [stylistUserId, clientUserId] } } });
    stylistProfileId = '';
  });

  async function seedBookingFixtures(): Promise<void> {
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

    const profile = await prisma.stylistProfile.create({
      data: {
        userId: stylistUserId,
        businessName: 'Booking Test Salon',
        depositPolicy: DEFAULT_DEPOSIT_POLICY,
        onboardingStatus: 'complete',
      },
    });
    stylistProfileId = profile.id;

    await prisma.serviceOffering.create({
      data: {
        id: offeringId,
        stylistId: stylistProfileId,
        styleName: 'Knotless Braids',
        sizeTier: 'Medium',
        lengthTier: 'Waist-length',
        basePrice: 150,
        estimatedDurationMinutes: 300,
      },
    });
  }

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
        confirmImmediately: true,
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().data.status).toBe('confirmed');
    expect(createResponse.json().data.agreedPrice).toBe('150');

    const bookingId = createResponse.json().data.id;

    const completeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/complete`,
      headers: stylistAuth,
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().data.status).toBe('completed');

    await app.close();
  });

  it('allows only one concurrent hold for the same slot', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedBookingFixtures();
    const app = await buildApp();
    const clientAuth = { authorization: await bearerFor(clientUserId, 'client') };
    const payload = {
      stylistId: stylistProfileId,
      serviceOfferingId: offeringId,
      startTime: '2026-08-02T14:00:00.000Z',
      source: 'client_direct',
    };

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/bookings/holds',
        headers: clientAuth,
        payload,
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/bookings/holds',
        headers: clientAuth,
        payload,
      }),
    ]);

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

    await prisma.booking.create({
      data: {
        stylistId: stylistProfileId,
        clientId: clientUserId,
        serviceOfferingId: offeringId,
        status: 'held',
        startTime: new Date('2026-08-03T10:00:00.000Z'),
        endTime: new Date('2026-08-03T15:00:00.000Z'),
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
        startTime: '2026-08-03T10:00:00.000Z',
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
});
