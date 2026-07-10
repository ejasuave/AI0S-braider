import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/db.js';

/**
 * Resolves the tenant `stylist_id` for the authenticated user.
 *
 * - stylist_owner: user.id until Ch.6 `stylist_profiles` exists (interim tenant key)
 * - stylist_staff: from `stylist_memberships` (Ch.4.3 expands permission scoping)
 * - client / admin: null (platform-wide scope)
 */
export async function resolveStylistId(
  userId: string,
  role: UserRole,
): Promise<string | null> {
  if (role === 'stylist_owner') {
    return userId;
  }

  if (role === 'stylist_staff') {
    const membership = await prisma.stylistMembership.findUnique({
      where: { userId },
    });
    return membership?.stylistId ?? null;
  }

  return null;
}
