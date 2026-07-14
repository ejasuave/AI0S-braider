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
  permissions: businessStaffPermissionsSchema,
  invitedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  removedAt: z.string().datetime().nullable(),
});

export type BusinessStaff = z.infer<typeof businessStaffSchema>;

export const staffInviteRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: e164PhoneSchema.optional(),
    permissions: businessStaffPermissionsSchema,
  })
  .refine((data) => data.email ?? data.phoneNumber, {
    message: 'Email or phone number is required',
  });

export const staffUpdatePermissionsSchema = z.object({
  permissions: businessStaffPermissionsSchema,
});

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
