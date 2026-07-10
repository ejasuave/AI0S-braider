import { describe, expect, it, vi } from 'vitest';
import { resolveStylistId } from './auth-context.js';

vi.mock('../../lib/db.js', () => ({
  prisma: {
    stylistMembership: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../profile/service.js', () => ({
  profileService: {
    getOrCreateProfile: vi.fn(),
  },
}));

import { prisma } from '../../lib/db.js';
import { profileService } from '../profile/service.js';

describe('resolveStylistId', () => {
  it('uses stylist profile id for stylist_owner', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const profileId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    vi.mocked(profileService.getOrCreateProfile).mockResolvedValue({
      id: profileId,
      userId,
      businessName: '',
      bio: null,
      locationArea: null,
      serviceAreaRadiusKm: null,
      cancellationPolicy: null,
      depositPolicy: null,
      workingHours: null,
      bufferMinutes: 0,
      onboardingStatus: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(resolveStylistId(userId, 'stylist_owner')).resolves.toBe(profileId);
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
