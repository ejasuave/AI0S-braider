import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { profileService } from '../profile/service.js';

/**
 * Resolves the tenant `stylist_id` for the authenticated user.
 *
 * - stylist_owner: `stylist_profiles.id` for the owner user
 * - stylist_staff: from `stylist_memberships`
 * - client / admin: null (platform-wide scope)
 */
export async function resolveStylistId(userId: string, role: UserRole): Promise<string | null> {
  if (role === 'stylist_owner') {
    const profile = await profileService.getOrCreateProfile(userId);
    return profile.id;
  }

  if (role === 'stylist_staff') {
    const membership = await prisma.stylistMembership.findUnique({
      where: { userId },
    });
    return membership?.stylistId ?? null;
  }

  return null;
}
