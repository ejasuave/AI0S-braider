import type { BusinessStaff } from '@prisma/client';
import {
  BUSINESS_PERMISSION_FLAGS,
  businessStaffPermissionsSchema,
  type BusinessPermissionFlag,
  type BusinessStaffPermissions,
} from '@project-braids/shared-types/api';

export { BUSINESS_PERMISSION_FLAGS, businessStaffPermissionsSchema };
export type { BusinessPermissionFlag, BusinessStaffPermissions };

export function parseStaffPermissions(value: unknown): BusinessStaffPermissions {
  return businessStaffPermissionsSchema.parse(value);
}

export function isStaffMembershipActive(
  staff: Pick<BusinessStaff, 'acceptedAt' | 'removedAt' | 'deactivatedAt'>,
): boolean {
  return staff.acceptedAt !== null && staff.removedAt === null && staff.deactivatedAt === null;
}

/** Ch.4.1 — removed, deactivated, or pending staff have no active permissions. */
export function staffHasPermission(
  staff:
    | Pick<BusinessStaff, 'permissions' | 'acceptedAt' | 'removedAt' | 'deactivatedAt'>
    | null
    | undefined,
  flag: BusinessPermissionFlag,
): boolean {
  if (!staff || !isStaffMembershipActive(staff)) {
    return false;
  }
  const permissions = parseStaffPermissions(staff.permissions);
  return permissions[flag] === true;
}

export function ownerHasAllPermissions(): true {
  return true;
}
