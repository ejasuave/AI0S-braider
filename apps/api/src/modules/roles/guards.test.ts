import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from '../identity/tokens.js';
import { signImpersonationAccessToken } from './impersonation.service.js';
import { businessService } from './business.service.js';

const owner = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'stylist_owner' as const,
  phone: '+447700900401',
  email: 'owner.ch4@example.com',
};

const staffUser = {
  id: '22222222-2222-2222-2222-222222222222',
  role: 'stylist_staff' as const,
  phone: '+447700900402',
  email: 'staff.ch4@example.com',
};

const client = {
  id: '33333333-3333-3333-3333-333333333333',
  role: 'client' as const,
  phone: '+447700900403',
  email: null,
};

const admin = {
  id: '44444444-4444-4444-4444-444444444444',
  role: 'admin' as const,
  phone: '+447700900404',
  email: 'admin.ch4@example.com',
};

let databaseAvailable = false;

async function bearer(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: '55555555-5555-5555-5555-555555555555',
  });
  return `Bearer ${token}`;
}

describe('roles guards and staff lifecycle', () => {
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
    await prisma.businessStaff.deleteMany();
    await prisma.business.deleteMany();
    await prisma.stylistProfile.deleteMany();
    await prisma.impersonationSession.deleteMany();
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, staffUser.id, client.id, admin.id] } },
    });
  });

  async function seedOwnerWithBusiness(): Promise<string> {
    await prisma.user.create({
      data: {
        id: owner.id,
        role: owner.role,
        phoneNumber: owner.phone,
        email: owner.email,
        phoneVerifiedAt: new Date(),
        passwordHash: 'hash',
      },
    });

    const business = await businessService.ensureBusinessForOwner(owner.id, 'Test Salon');
    await prisma.stylistProfile.create({
      data: {
        userId: owner.id,
        businessId: business.id,
        businessName: 'Test Salon',
      },
    });

    return business.id;
  }

  it('rejects client on stylist-only access route', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await prisma.user.create({
      data: {
        id: client.id,
        role: client.role,
        phoneNumber: client.phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/access/stylist-only',
      headers: { authorization: await bearer(client.id, client.role) },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('allows owner on permission-guarded route without business_staff row', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const businessId = await seedOwnerWithBusiness();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/permission-demo`,
      headers: { authorization: await bearer(owner.id, owner.role) },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('allows staff with permission and rejects staff without it', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const businessId = await seedOwnerWithBusiness();

    await prisma.user.create({
      data: {
        id: staffUser.id,
        role: staffUser.role,
        phoneNumber: staffUser.phone,
        email: staffUser.email,
        phoneVerifiedAt: new Date(),
      },
    });

    await prisma.businessStaff.create({
      data: {
        businessId,
        userId: staffUser.id,
        permissions: {
          can_manage_bookings: true,
          can_manage_pricing: false,
          can_view_payouts: false,
          can_manage_staff: false,
        },
        acceptedAt: new Date(),
      },
    });

    const app = await buildApp();

    const allowed = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/permission-demo`,
      headers: { authorization: await bearer(staffUser.id, staffUser.role) },
    });
    expect(allowed.statusCode).toBe(200);

    const denied = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/staff`,
      headers: { authorization: await bearer(staffUser.id, staffUser.role) },
    });
    expect(denied.statusCode).toBe(403);

    await app.close();
  });

  it('rejects removed staff even when permissions json still has the flag', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const businessId = await seedOwnerWithBusiness();

    await prisma.user.create({
      data: {
        id: staffUser.id,
        role: staffUser.role,
        phoneNumber: staffUser.phone,
        email: staffUser.email,
        phoneVerifiedAt: new Date(),
      },
    });

    await prisma.businessStaff.create({
      data: {
        businessId,
        userId: staffUser.id,
        permissions: {
          can_manage_bookings: true,
          can_manage_pricing: false,
          can_view_payouts: false,
          can_manage_staff: false,
        },
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/permission-demo`,
      headers: { authorization: await bearer(staffUser.id, staffUser.role) },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('runs staff invite → accept → remove lifecycle', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const businessId = await seedOwnerWithBusiness();

    await prisma.user.create({
      data: {
        id: staffUser.id,
        role: 'client',
        phoneNumber: staffUser.phone,
        email: staffUser.email,
        phoneVerifiedAt: new Date(),
      },
    });

    const app = await buildApp();

    const invite = await app.inject({
      method: 'POST',
      url: `/api/v1/businesses/${businessId}/staff/invite`,
      headers: { authorization: await bearer(owner.id, owner.role) },
      payload: {
        email: staffUser.email,
        permissions: {
          can_manage_bookings: true,
          can_manage_pricing: false,
          can_view_payouts: false,
          can_manage_staff: false,
        },
      },
    });
    expect(invite.statusCode).toBe(201);
    const invitationId = invite.json().data.invitation.id as string;

    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/invitations/${invitationId}/accept`,
      headers: { authorization: await bearer(staffUser.id, 'client') },
    });
    expect(accept.statusCode).toBe(200);

    const allowed = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/permission-demo`,
      headers: { authorization: await bearer(staffUser.id, staffUser.role) },
    });
    expect(allowed.statusCode).toBe(200);

    const staffRow = await prisma.businessStaff.findUnique({ where: { id: invitationId } });
    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/v1/businesses/${businessId}/staff/${staffRow!.id}`,
      headers: { authorization: await bearer(owner.id, owner.role) },
    });
    expect(remove.statusCode).toBe(200);

    const blocked = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${businessId}/permission-demo`,
      headers: { authorization: await bearer(staffUser.id, staffUser.role) },
    });
    expect(blocked.statusCode).toBe(403);

    await app.close();
  });

  it('rejects impersonation token on sensitive payout route', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedOwnerWithBusiness();

    await prisma.user.create({
      data: {
        id: admin.id,
        role: admin.role,
        phoneNumber: admin.phone,
        email: admin.email,
        phoneVerifiedAt: new Date(),
      },
    });

    const session = await prisma.impersonationSession.create({
      data: {
        adminUserId: admin.id,
        targetUserId: owner.id,
        reason: 'Support ticket #12345 investigation',
        createdFromIp: '127.0.0.1',
      },
    });

    const { token } = await signImpersonationAccessToken({
      targetUserId: owner.id,
      targetRole: owner.role,
      adminUserId: admin.id,
      impersonationSessionId: session.id,
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/connect/onboard',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toContain('impersonation');

    await app.close();
  });

  it('rejects unknown permission flag on staff invite', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const businessId = await seedOwnerWithBusiness();
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/businesses/${businessId}/staff/invite`,
      headers: { authorization: await bearer(owner.id, owner.role) },
      payload: {
        email: 'newstaff@example.com',
        permissions: {
          can_manage_bookings: true,
          can_hack_everything: true,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });
});
