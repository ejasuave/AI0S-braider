import { z } from 'zod';

const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be E.164 format (e.g. +447700900123)');

/** Granular business permission flags (Ch.4.1 + Ch.6.1). */
export const BUSINESS_PERMISSION_FLAGS = [
  'can_manage_bookings',
  'can_manage_pricing',
  'can_manage_profile',
  'can_view_payouts',
  'can_manage_staff',
] as const;

export type BusinessPermissionFlag = (typeof BUSINESS_PERMISSION_FLAGS)[number];

export const businessStaffPermissionsSchema = z
  .object({
    can_manage_bookings: z.boolean().default(false),
    can_manage_pricing: z.boolean().default(false),
    can_manage_profile: z.boolean().default(false),
    can_view_payouts: z.boolean().default(false),
    can_manage_staff: z.boolean().default(false),
  })
  .strict();

export type BusinessStaffPermissions = z.infer<typeof businessStaffPermissionsSchema>;

/** Team role labels (map to permission presets). Owner is not inviteable. */
export const BUSINESS_STAFF_ROLES = ['manager', 'stylist', 'receptionist'] as const;
export type BusinessStaffRole = (typeof BUSINESS_STAFF_ROLES)[number];

export const businessStaffRoleSchema = z.enum(BUSINESS_STAFF_ROLES);

export const BUSINESS_STAFF_ROLE_LABELS: Record<BusinessStaffRole, string> = {
  manager: 'Manager',
  stylist: 'Stylist',
  receptionist: 'Receptionist',
};

export const STAFF_ROLE_PERMISSION_PRESETS: Record<BusinessStaffRole, BusinessStaffPermissions> = {
  manager: {
    can_manage_bookings: true,
    can_manage_pricing: true,
    can_manage_profile: true,
    can_view_payouts: false,
    can_manage_staff: true,
  },
  stylist: {
    can_manage_bookings: true,
    can_manage_pricing: false,
    can_manage_profile: false,
    can_view_payouts: false,
    can_manage_staff: false,
  },
  receptionist: {
    can_manage_bookings: true,
    can_manage_pricing: false,
    can_manage_profile: false,
    can_view_payouts: false,
    can_manage_staff: false,
  },
};

export const BUSINESS_STAFF_STATUSES = ['pending', 'active', 'deactivated'] as const;
export type BusinessStaffStatus = (typeof BUSINESS_STAFF_STATUSES)[number];

export const businessSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  businessName: z.string(),
  createdAt: z.string().datetime(),
});

export type Business = z.infer<typeof businessSchema>;

export const businessStaffSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  inviteeEmail: z.string().email().nullable(),
  inviteePhone: z.string().nullable(),
  displayName: z.string().nullable(),
  role: businessStaffRoleSchema,
  permissions: businessStaffPermissionsSchema,
  status: z.enum(BUSINESS_STAFF_STATUSES),
  invitedAt: z.string().datetime(),
  inviteExpiresAt: z.string().datetime().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  deactivatedAt: z.string().datetime().nullable(),
  removedAt: z.string().datetime().nullable(),
});

export type BusinessStaff = z.infer<typeof businessStaffSchema>;

export const staffInviteRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: e164PhoneSchema.optional(),
    role: businessStaffRoleSchema.default('stylist'),
    displayName: z.string().trim().min(1).max(120).optional(),
    /** Defaults to role preset when omitted (API also normalizes before parse). */
    permissions: businessStaffPermissionsSchema.optional(),
  })
  .transform((data) => ({
    ...data,
    permissions: data.permissions ?? STAFF_ROLE_PERMISSION_PRESETS[data.role],
  }))
  .refine((data) => data.email ?? data.phoneNumber, {
    message: 'Email or phone number is required',
  });

export type StaffInviteRequest = z.infer<typeof staffInviteRequestSchema>;

export const staffUpdateRequestSchema = z
  .object({
    role: businessStaffRoleSchema.optional(),
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    permissions: businessStaffPermissionsSchema.optional(),
  })
  .refine((data) => data.role !== undefined || data.displayName !== undefined || data.permissions !== undefined, {
    message: 'At least one field is required',
  });

export type StaffUpdateRequest = z.infer<typeof staffUpdateRequestSchema>;

/** @deprecated Prefer staffUpdateRequestSchema */
export const staffUpdatePermissionsSchema = z.object({
  permissions: businessStaffPermissionsSchema,
});

export const staffAcceptInvitationRequestSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export type StaffAcceptInvitationRequest = z.infer<typeof staffAcceptInvitationRequestSchema>;

export const impersonationStartRequestSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const impersonationTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  impersonationSessionId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  adminUserId: z.string().uuid(),
});
