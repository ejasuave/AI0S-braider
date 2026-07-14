import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from '../identity/tokens.js';
import { MockGoogleCalendarApiClient, setGoogleCalendarApiClient } from './google-client.js';
import { calendarSyncService } from './sync.js';
import { calendarConflictService } from '../booking/calendar-conflicts.js';

const ownerUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const businessIdSeed = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let databaseAvailable = false;
let businessId = '';
let stylistProfileId = '';
let mockClient: MockGoogleCalendarApiClient;

async function bearerFor(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  });
  return `Bearer ${token}`;
}

describe('calendar routes', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  beforeEach(() => {
    mockClient = new MockGoogleCalendarApiClient();
    setGoogleCalendarApiClient(mockClient);
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.externalCalendarLink.deleteMany({ where: { businessId } });
    await prisma.calendarConflict.deleteMany({ where: { businessId } });
    await prisma.calendarConnection.deleteMany({ where: { businessId } });
    await prisma.booking.deleteMany({ where: { stylistId: stylistProfileId } });
    await prisma.workingHour.deleteMany({ where: { businessId } });
    await prisma.serviceOffering.deleteMany({ where: { businessId } });
    await prisma.businessPolicy.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessIdSeed } });
    await prisma.stylistProfile.deleteMany({ where: { userId: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    businessId = '';
    stylistProfileId = '';
  });

  async function seedCalendarFixtures(): Promise<void> {
    await prisma.user.create({
      data: {
        id: ownerUserId,
        role: 'stylist_owner',
        phoneNumber: '+447700900501',
        email: 'ch8-calendar@example.com',
        phoneVerifiedAt: new Date(),
      },
    });

    const business = await prisma.business.create({
      data: {
        id: businessIdSeed,
        ownerUserId: ownerUserId,
        businessName: 'Ch8 Calendar Salon',
      },
    });
    businessId = business.id;

    const profile = await prisma.stylistProfile.create({
      data: {
        userId: ownerUserId,
        businessId,
        businessName: 'Ch8 Calendar Salon',
        bufferMinutes: 15,
        onboardingStatus: 'complete',
      },
    });
    stylistProfileId = profile.id;

    await prisma.workingHour.create({
      data: {
        businessId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      },
    });

    await prisma.serviceOffering.create({
      data: {
        businessId,
        stylistId: stylistProfileId,
        styleName: 'Box Braids',
        basePrice: 120,
        estimatedDurationMinutes: 300,
      },
    });
  }

  it('returns public availability for a business with working hours', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedCalendarFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/availability?durationMinutes=60&from=2026-08-03T00:00:00.000Z&to=2026-08-03T23:59:59.999Z&limit=5`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.businessId).toBe(businessId);
    expect(response.json().data.slots.length).toBeGreaterThan(0);

    await app.close();
  });

  it('rejects availability queries exceeding the configured maximum range', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedCalendarFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/availability?durationMinutes=60&from=2026-08-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/cannot exceed/i);

    await app.close();
  });

  it('updates scheduling buffer minutes for the authenticated business', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedCalendarFixtures();
    const app = await buildApp();
    const auth = { authorization: await bearerFor(ownerUserId, 'stylist_owner') };

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/businesses/me/scheduling',
      headers: auth,
      payload: { bufferMinutes: 20 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.bufferMinutes).toBe(20);

    await app.close();
  });
});

describe('calendar sync service', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  beforeEach(() => {
    mockClient = new MockGoogleCalendarApiClient();
    setGoogleCalendarApiClient(mockClient);
    vi.spyOn(calendarConflictService, 'flagExternalCalendarConflict');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!databaseAvailable) return;
    await prisma.externalCalendarLink.deleteMany({ where: { businessId } });
    await prisma.calendarConflict.deleteMany({ where: { businessId } });
    await prisma.calendarConnection.deleteMany({ where: { businessId } });
    await prisma.booking.deleteMany({ where: { stylistId: stylistProfileId } });
    await prisma.business.deleteMany({ where: { id: businessIdSeed } });
    await prisma.stylistProfile.deleteMany({ where: { userId: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    businessId = '';
    stylistProfileId = '';
  });

  async function seedConnectedBusiness(): Promise<string> {
    await prisma.user.create({
      data: {
        id: ownerUserId,
        role: 'stylist_owner',
        phoneNumber: '+447700900502',
        email: 'ch8-sync@example.com',
        phoneVerifiedAt: new Date(),
      },
    });

    const business = await prisma.business.create({
      data: {
        id: businessIdSeed,
        ownerUserId: ownerUserId,
        businessName: 'Ch8 Sync Salon',
      },
    });
    businessId = business.id;

    const profile = await prisma.stylistProfile.create({
      data: {
        userId: ownerUserId,
        businessId,
        businessName: 'Ch8 Sync Salon',
        onboardingStatus: 'complete',
      },
    });
    stylistProfileId = profile.id;

    await calendarSyncService.connectGoogleCalendar({
      businessId,
      code: 'mock-code',
      redirectUri: 'http://localhost:3000/stylist/calendar',
    });

    return businessId;
  }

  it('pushes confirmed bookings to Google Calendar and stores a link', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedConnectedBusiness();

    const booking = await prisma.booking.create({
      data: {
        stylistId: stylistProfileId,
        status: 'confirmed',
        startTime: new Date('2026-08-10T10:00:00.000Z'),
        endTime: new Date('2026-08-10T12:00:00.000Z'),
        agreedPrice: 100,
        agreedDurationMinutes: 120,
        depositAmount: 0,
        depositStatus: 'pending',
        source: 'dashboard_manual',
      },
    });

    await calendarSyncService.pushToExternalCalendar(booking.id);

    const link = await prisma.externalCalendarLink.findFirst({
      where: { bookingId: booking.id },
    });
    expect(link?.syncStatus).toBe('synced');
    expect(mockClient.events.size).toBe(1);
  });

  it('deletes external events when a platform booking is cancelled', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedConnectedBusiness();

    const booking = await prisma.booking.create({
      data: {
        stylistId: stylistProfileId,
        status: 'confirmed',
        startTime: new Date('2026-08-11T10:00:00.000Z'),
        endTime: new Date('2026-08-11T12:00:00.000Z'),
        agreedPrice: 100,
        agreedDurationMinutes: 120,
        depositAmount: 0,
        depositStatus: 'pending',
        source: 'dashboard_manual',
      },
    });

    await calendarSyncService.pushToExternalCalendar(booking.id);
    await calendarSyncService.removeExternalCalendarEvent(booking.id);

    const link = await prisma.externalCalendarLink.findFirst({
      where: { bookingId: booking.id },
    });
    expect(link).toBeNull();
    expect(mockClient.events.size).toBe(0);
  });

  it('flags untracked external events during reconciliation', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const seededBusinessId = await seedConnectedBusiness();

    const eventStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    eventStart.setUTCMinutes(0, 0, 0);
    const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

    await mockClient.createEvent({
      accessToken: 'token',
      calendarId: 'primary',
      summary: 'Personal appointment',
      start: eventStart.toISOString(),
      end: eventEnd.toISOString(),
    });

    const result = await calendarSyncService.reconcileBusinessCalendar(seededBusinessId);

    expect(result.flagged).toBeGreaterThan(0);
    expect(calendarConflictService.flagExternalCalendarConflict).toHaveBeenCalled();
  });
});
