import { describe, expect, it, vi } from 'vitest';
import { resolveStylistId } from './auth-context.js';

vi.mock('../../lib/db.js', () => ({
  prisma: {
    businessStaff: {
      findFirst: vi.fn(),
    },
    stylistProfile: {
      findFirst: vi.fn(),
    },
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

vi.mock('../roles/business.service.js', () => ({
  businessService: {
    ensureBusinessForOwner: vi.fn().mockResolvedValue({ id: 'biz-1' }),
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
      directoryVisible: false,
      photoUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(resolveStylistId(userId, 'stylist_owner')).resolves.toBe(profileId);
  });

  it('resolves owner profile via business_staff for stylist_staff', async () => {
    vi.mocked(prisma.businessStaff.findFirst).mockResolvedValue({
      id: 'staff-1',
      businessId: 'biz-1',
      userId: '33333333-3333-3333-3333-333333333333',
      inviteeEmail: null,
      inviteePhone: null,
      permissions: {},
      invitedAt: new Date(),
      acceptedAt: new Date(),
      removedAt: null,
      business: {
        id: 'biz-1',
        ownerUserId: 'owner-1',
        businessName: '',
        createdAt: new Date(),
      },
    } as never);

    vi.mocked(prisma.stylistProfile.findFirst).mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
    } as never);

    await expect(
      resolveStylistId('33333333-3333-3333-3333-333333333333', 'stylist_staff'),
    ).resolves.toBe('22222222-2222-2222-2222-222222222222');
  });

  it('returns null for client and admin', async () => {
    await expect(resolveStylistId('a', 'client')).resolves.toBeNull();
    await expect(resolveStylistId('a', 'admin')).resolves.toBeNull();
  });
});
