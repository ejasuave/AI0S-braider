import type { BusinessStaff } from '@prisma/client';
import type { BusinessStaff as BusinessStaffDto } from '@project-braids/shared-types/api';
import { businessStaffPermissionsSchema } from '@project-braids/shared-types/api';
import { staffStatusFromRow } from './staff.service.js';

export function toBusinessStaffDto(row: BusinessStaff): BusinessStaffDto {
  return {
    id: row.id,
    businessId: row.businessId,
    userId: row.userId,
    inviteeEmail: row.inviteeEmail,
    inviteePhone: row.inviteePhone,
    displayName: row.displayName,
    role: row.role,
    permissions: businessStaffPermissionsSchema.parse(row.permissions),
    status: staffStatusFromRow(row),
    invitedAt: row.invitedAt.toISOString(),
    inviteExpiresAt: row.inviteExpiresAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
  };
}
