import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { signAccessToken } from './tokens.js';

const users = {
  admin: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    role: 'admin' as const,
    phone: '+447700900301',
    email: 'admin@example.com',
  },
  stylist: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    role: 'stylist_owner' as const,
    phone: '+447700900302',
    email: 'owner@example.com',
  },
  client: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    role: 'client' as const,
    phone: '+447700900303',
    email: null,
  },
};

let databaseAvailable = false;

async function bearerFor(userId: string, role: string): Promise<string> {
  const { token } = await signAccessToken({
    userId,
    role,
    sessionId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  });
  return `Bearer ${token}`;
}

describe('access routes', () => {
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
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users).map((u) => u.id) } },
    });
  });

  async function seedUsers(): Promise<void> {
    for (const user of Object.values(users)) {
      await prisma.user.create({
        data: {
          id: user.id,
          role: user.role,
          phoneNumber: user.phone,
          email: user.email,
          phoneVerifiedAt: new Date(),
        },
      });
    }
  }

  it('allows admin probe for admin role', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedUsers();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/access/admin',
      headers: { authorization: await bearerFor(users.admin.id, users.admin.role) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.scope).toBe('platform_admin');

    await app.close();
  });

  it('forbids client on admin probe', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedUsers();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/access/admin',
      headers: { authorization: await bearerFor(users.client.id, users.client.role) },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns stylist tenant id for stylist owner', async ({ skip }) => {
    if (!databaseAvailable) skip();
    await seedUsers();
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/access/stylist',
      headers: { authorization: await bearerFor(users.stylist.id, users.stylist.role) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.stylistId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.json().data.stylistId).not.toBe(users.stylist.id);

    await prisma.stylistProfile.deleteMany({ where: { userId: users.stylist.id } });
    await app.close();
  });
});
