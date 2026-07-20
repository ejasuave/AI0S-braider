import { prisma } from '../../lib/db.js';
import {
  businessStaffPermissionsSchema,
  type BusinessStaffPermissions,
  type UserRole,
} from '@project-braids/shared-types/api';

export const OWNER_PERMISSIONS: BusinessStaffPermissions = {
  can_manage_bookings: true,
  can_manage_pricing: true,
  can_manage_profile: true,
  can_view_payouts: true,
  can_manage_staff: true,
};

export async function resolvePermissionsForUser(
  userId: string,
  role: UserRole,
): Promise<BusinessStaffPermissions | null> {
  if (role === 'stylist_owner' || role === 'admin') {
    return OWNER_PERMISSIONS;
  }

  if (role !== 'stylist_staff') {
    return null;
  }

  const staff = await prisma.businessStaff.findFirst({
    where: {
      userId,
      acceptedAt: { not: null },
      removedAt: null,
      deactivatedAt: null,
    },
    select: { permissions: true },
  });

  if (!staff) {
    return businessStaffPermissionsSchema.parse({});
  }

  return businessStaffPermissionsSchema.parse(staff.permissions);
}
