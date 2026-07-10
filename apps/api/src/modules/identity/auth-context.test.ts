import { describe, expect, it, vi } from 'vitest';
import { resolveStylistId } from './auth-context.js';

vi.mock('../../lib/db.js', () => ({
  prisma: {
    stylistMembership: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/db.js';

describe('resolveStylistId', () => {
  it('uses user id for stylist_owner', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    await expect(resolveStylistId(id, 'stylist_owner')).resolves.toBe(id);
  });

  it('loads membership for stylist_staff', async () => {
    vi.mocked(prisma.stylistMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      stylistId: '22222222-2222-2222-2222-222222222222',
      userId: '33333333-3333-3333-3333-333333333333',
      createdAt: new Date(),
    });

    await expect(
      resolveStylistId('33333333-3333-3333-3333-333333333333', 'stylist_staff'),
    ).resolves.toBe('22222222-2222-2222-2222-222222222222');
  });

  it('returns null for client and admin', async () => {
    await expect(resolveStylistId('a', 'client')).resolves.toBeNull();
    await expect(resolveStylistId('a', 'admin')).resolves.toBeNull();
  });
});
