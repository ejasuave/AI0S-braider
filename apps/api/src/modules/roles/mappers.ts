import type { BusinessStaff } from '@prisma/client';
import type { BusinessStaff as BusinessStaffDto } from '@project-braids/shared-types/api';
import { businessStaffPermissionsSchema } from '@project-braids/shared-types/api';

export function toBusinessStaffDto(row: BusinessStaff): BusinessStaffDto {
  return {
    id: row.id,
    businessId: row.businessId,
    userId: row.userId,
    inviteeEmail: row.inviteeEmail,
    inviteePhone: row.inviteePhone,
    permissions: businessStaffPermissionsSchema.parse(row.permissions),
    invitedAt: row.invitedAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
  };
}
