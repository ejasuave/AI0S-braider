import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { profileService } from '../profile/service.js';
import { businessService } from '../roles/business.service.js';

/**
 * Resolves the tenant `stylist_id` for the authenticated user.
 *
 * - stylist_owner: `stylist_profiles.id` for the owner user
 * - stylist_staff: profile id from active `business_staff` → business → owner profile
 * - client / admin: null (platform-wide scope)
 */
export async function resolveStylistId(userId: string, role: UserRole): Promise<string | null> {
  if (role === 'stylist_owner') {
    const profile = await profileService.getOrCreateProfile(userId);
    await businessService.ensureBusinessForOwner(userId, profile.businessName);
    return profile.id;
  }

  if (role === 'stylist_staff') {
    const staff = await prisma.businessStaff.findFirst({
      where: {
        userId,
        acceptedAt: { not: null },
        removedAt: null,
        deactivatedAt: null,
      },
      include: { business: true },
    });

    if (staff?.business) {
      const profile = await prisma.stylistProfile.findFirst({
        where: { userId: staff.business.ownerUserId },
        select: { id: true },
      });
      return profile?.id ?? null;
    }

    const legacy = await prisma.stylistMembership.findUnique({ where: { userId } });
    return legacy?.stylistId ?? null;
  }

  return null;
}

export async function resolveBusinessId(userId: string, role: UserRole): Promise<string | null> {
  return businessService.resolveBusinessIdForUser(userId, role);
}
