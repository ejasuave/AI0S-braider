import { z } from 'zod';

export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be E.164 format (e.g. +447700900123)');

export const userRoleSchema = z.enum(['stylist_owner', 'stylist_staff', 'client', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const otpPurposeSchema = z.enum(['phone_verify', 'login', 'password_reset']);
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const authUserSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  phoneNumber: z.string(),
  email: z.string().email().nullable(),
  phoneVerified: z.boolean(),
  emailVerified: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authContextSchema = z.object({
  user: authUserSchema,
  sessionId: z.string().uuid(),
  stylistId: z.string().uuid().nullable(),
  businessId: z.string().uuid().nullable(),
  impersonation: z
    .object({
      sessionId: z.string().uuid(),
      adminUserId: z.string().uuid(),
      targetUserId: z.string().uuid(),
    })
    .nullable()
    .optional(),
});

export type AuthContext = z.infer<typeof authContextSchema>;

export const accessProbeResponseSchema = z.object({
  role: userRoleSchema,
  stylistId: z.string().uuid().nullable(),
  scope: z.string(),
});

export type AccessProbeResponse = z.infer<typeof accessProbeResponseSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  refreshToken: z.string().optional(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const registerStylistRequestSchema = z.object({
  phoneNumber: e164PhoneSchema,
  email: z.string().email(),
  password: passwordSchema,
});

/** Ch.3.1 — self-service stylist signup (role fixed to stylist_owner). */
export const signupRequestSchema = registerStylistRequestSchema.extend({
  role: z.literal('stylist_owner').default('stylist_owner'),
});

export const registerClientRequestSchema = z.object({
  phoneNumber: e164PhoneSchema,
});

export const registerClientResponseSchema = z.object({
  otpRequired: z.literal(true),
  otpPurpose: otpPurposeSchema,
});

export const registerStylistResponseSchema = z.object({
  userId: z.string().uuid(),
  otpRequired: z.literal(true),
  otpPurpose: otpPurposeSchema,
});

export const loginRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: e164PhoneSchema.optional(),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .refine((data) => data.email ?? data.phoneNumber, {
    message: 'Email or phone number is required',
  });

export const otpRequestSchema = z.object({
  phoneNumber: e164PhoneSchema,
  purpose: otpPurposeSchema,
});

export const otpVerifyRequestSchema = z.object({
  phoneNumber: e164PhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  purpose: otpPurposeSchema,
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const googleOAuthRequestSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url(),
});

export const appleOAuthRequestSchema = z.object({
  idToken: z.string().min(1),
  nonce: z.string().optional(),
});

export const passwordForgotRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const accountRecoveryRequestSchema = z.object({
  email: z.string().email(),
  phoneNumber: e164PhoneSchema.optional(),
  reason: z.string().min(10).max(2000),
});

export const phoneChangeRequestSchema = z.object({
  requestedPhoneNumber: e164PhoneSchema,
});

export const phoneChangeResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.literal('pending'),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const otpRequestResponseSchema = z.object({
  sent: z.literal(true),
  expiresInSeconds: z.number().int().positive(),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const accountRecoveryResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.literal('pending'),
});
