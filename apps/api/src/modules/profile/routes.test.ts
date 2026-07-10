import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from '../identity/tokens.js';

const stylistUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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

describe('profile routes', () => {
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
    await prisma.portfolioItem.deleteMany({ where: { stylistId: stylistProfileId } });
    await prisma.serviceOffering.deleteMany({ where: { stylistId: stylistProfileId } });
    await prisma.stylistProfile.deleteMany({ where: { userId: stylistUserId } });
    await prisma.user.deleteMany({ where: { id: stylistUserId } });
    stylistProfileId = '';
  });

  async function seedStylist(): Promise<void> {
    await prisma.user.create({
      data: {
        id: stylistUserId,
        role: 'stylist_owner',
        phoneNumber: '+447700900310',
        email: 'profile-owner@example.com',
        phoneVerifiedAt: new Date(),
      },
    });
  }

  it('creates profile on first GET /profile/me', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedStylist();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/me',
      headers: { authorization: await bearerFor(stylistUserId, 'stylist_owner') },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.userId).toBe(stylistUserId);
    expect(response.json().data.onboardingStatus).toBe('in_progress');
    stylistProfileId = response.json().data.id;

    await app.close();
  });

  it('creates and looks up structured service offerings', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedStylist();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(stylistUserId, 'stylist_owner') };

    const profileResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/me',
      headers: auth,
    });
    stylistProfileId = profileResponse.json().data.id;

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/services',
      headers: auth,
      payload: {
        styleName: 'Knotless Braids',
        sizeTier: 'Medium',
        lengthTier: 'Waist-length',
        basePrice: 150,
        estimatedDurationMinutes: 300,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const lookupResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/services/lookup?styleName=Knotless%20Braids&sizeTier=Medium&lengthTier=Waist-length',
      headers: auth,
    });

    expect(lookupResponse.statusCode).toBe(200);
    expect(lookupResponse.json().data.matchType).toBe('exact');
    expect(lookupResponse.json().data.confidence).toBe(1);
    expect(lookupResponse.json().data.offering.basePrice).toBe('150');

    await app.close();
  });

  it('updates policies and working hours', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedStylist();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(stylistUserId, 'stylist_owner') };

    await app.inject({ method: 'GET', url: '/api/v1/profile/me', headers: auth });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/profile/me',
      headers: auth,
      payload: {
        businessName: 'Braids by Bea',
        depositPolicy: { type: 'percent', value: 30 },
        cancellationPolicy: {
          windowHours: 48,
          feeType: 'percent',
          feeAmount: 50,
          noShowFeeAmount: 100,
        },
        workingHours: {
          monday: { enabled: true, start: '10:00', end: '18:00' },
          tuesday: { enabled: true, start: '10:00', end: '18:00' },
          wednesday: { enabled: true, start: '10:00', end: '18:00' },
          thursday: { enabled: true, start: '10:00', end: '18:00' },
          friday: { enabled: true, start: '10:00', end: '18:00' },
          saturday: { enabled: false, start: '10:00', end: '16:00' },
          sunday: { enabled: false, start: '10:00', end: '16:00' },
        },
        bufferMinutes: 15,
        onboardingStatus: 'complete',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.businessName).toBe('Braids by Bea');
    expect(response.json().data.depositPolicy.value).toBe(30);
    expect(response.json().data.bufferMinutes).toBe(15);
    expect(response.json().data.onboardingStatus).toBe('complete');

    stylistProfileId = response.json().data.id;
    await app.close();
  });

  it('lists seeded style categories publicly', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/style-categories',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.length).toBeGreaterThan(0);

    await app.close();
  });
});
