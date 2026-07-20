import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from '../identity/tokens.js';
import { setInstagramApiClient, MockInstagramApiClient } from './instagram-client.js';
import { PORTFOLIO_ITEM_LIMIT } from './mappers.js';

const ownerUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const staffUserId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

let databaseAvailable = false;
let businessId = '';
let stylistProfileId = '';

async function bearerFor(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  });
  return `Bearer ${token}`;
}

describe('stylist-profile routes', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    setInstagramApiClient(new MockInstagramApiClient());
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    if (businessId) {
      await prisma.portfolioItem.deleteMany({ where: { businessId } });
      await prisma.serviceOffering.deleteMany({ where: { businessId } });
      await prisma.scheduleException.deleteMany({ where: { businessId } });
      await prisma.workingHour.deleteMany({ where: { businessId } });
      await prisma.instagramConnection.deleteMany({ where: { businessId } });
      await prisma.businessPolicy.deleteMany({ where: { businessId } });
      await prisma.businessStaff.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
    }
    await prisma.business.deleteMany({ where: { ownerUserId } });
    await prisma.stylistProfile.deleteMany({
      where: { userId: { in: [ownerUserId, staffUserId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, staffUserId] } } });
    businessId = '';
    stylistProfileId = '';
  });

  async function seedOwner(): Promise<void> {
    await prisma.user.upsert({
      where: { id: ownerUserId },
      update: {
        role: 'stylist_owner',
        phoneNumber: '+447700900320',
        email: 'ch6-owner@example.com',
        phoneVerifiedAt: new Date(),
      },
      create: {
        id: ownerUserId,
        role: 'stylist_owner',
        phoneNumber: '+447700900320',
        email: 'ch6-owner@example.com',
        phoneVerifiedAt: new Date(),
      },
    });
  }

  it('supports partial PATCH on /businesses/me', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };

    await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/businesses/me',
      headers: auth,
      payload: { bio: 'Specialist in knotless braids' },
    });

    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.bio).toBe('Specialist in knotless braids');

    businessId = patch.json().data.id;
    await app.close();
  });

  it('rejects staff without can_manage_profile', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    await prisma.user.create({
      data: {
        id: staffUserId,
        role: 'stylist_staff',
        phoneNumber: '+447700900321',
        email: 'ch6-staff@example.com',
        phoneVerifiedAt: new Date(),
      },
    });

    const app = await buildApp();
    const ownerAuth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses',
      headers: ownerAuth,
    });
    businessId = create.json().data.id;

    await prisma.businessStaff.create({
      data: {
        businessId,
        userId: staffUserId,
        permissions: {
          can_manage_bookings: true,
          can_manage_pricing: false,
          can_manage_profile: false,
          can_view_payouts: false,
          can_manage_staff: false,
        },
        acceptedAt: new Date(),
      },
    });

    const staffAuth = { authorization: await bearerFor(staffUserId, 'stylist_staff') };
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/businesses/me',
      headers: staffAuth,
      payload: { bio: 'Should fail' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('enforces onboarding completion gate', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/businesses/me/onboarding-status',
      headers: auth,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('service');

    businessId = (
      await app.inject({ method: 'GET', url: '/api/v1/businesses/me', headers: auth })
    ).json().data.id;
    await app.close();
  });

  it('rejects invalid percentage deposit policy', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/businesses/me/policy',
      headers: auth,
      payload: {
        depositType: 'percentage',
        depositValue: 150,
        cancellationWindowHours: 24,
        noShowFeeType: 'forfeit_deposit',
      },
    });

    expect(response.statusCode).toBe(400);
    businessId = (
      await app.inject({ method: 'GET', url: '/api/v1/businesses/me', headers: auth })
    ).json().data.id;
    await app.close();
  });

  it('rejects overlapping working-hour shifts', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/businesses/me/working-hours',
      headers: auth,
      payload: {
        hours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    businessId = (
      await app.inject({ method: 'GET', url: '/api/v1/businesses/me', headers: auth })
    ).json().data.id;
    await app.close();
  });

  it('enforces portfolio item limit', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    const create = await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });
    businessId = create.json().data.id;
    const profile = await prisma.stylistProfile.findFirst({ where: { businessId } });
    stylistProfileId = profile!.id;

    const categories = await app.inject({
      method: 'GET',
      url: '/api/v1/style-categories',
      headers: auth,
    });
    const categoryId = (categories.json().data as Array<{ id: string; isGroup?: boolean }>).find(
      (row) => !row.isGroup,
    )?.id;
    const serviceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses/me/services',
      headers: auth,
      payload: categoryId
        ? { styleCategoryId: categoryId, basePrice: 80, estimatedDurationMinutes: 120 }
        : {
            customStyleName: 'Box Braids',
            basePrice: 80,
            estimatedDurationMinutes: 120,
          },
    });
    expect(serviceRes.statusCode).toBe(201);
    const serviceId = serviceRes.json().data.id as string;

    const rows = Array.from({ length: PORTFOLIO_ITEM_LIMIT }, (_, index) => ({
      businessId,
      stylistId: stylistProfileId,
      serviceOfferingId: serviceId,
      imageUrl: `https://cdn.example.com/p/${index}.jpg`,
      source: 'manual' as const,
      displayOrder: index,
    }));
    await prisma.portfolioItem.createMany({ data: rows });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses/me/portfolio/upload-url',
      headers: auth,
      payload: { contentType: 'image/jpeg', serviceOfferingId: serviceId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/50|maximum of 10/i);
    await app.close();
  });

  it('returns INSTAGRAM_ACCOUNT_INELIGIBLE for ineligible accounts', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwner();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };
    await app.inject({ method: 'POST', url: '/api/v1/businesses', headers: auth });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/businesses/me/instagram/connect',
      headers: auth,
      payload: { code: 'ineligible', redirectUri: 'http://localhost:3000/callback' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('INSTAGRAM_ACCOUNT_INELIGIBLE');
    businessId = (
      await app.inject({ method: 'GET', url: '/api/v1/businesses/me', headers: auth })
    ).json().data.id;
    await app.close();
  });
});
