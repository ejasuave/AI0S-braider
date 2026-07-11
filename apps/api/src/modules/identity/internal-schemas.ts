import { z } from 'zod';
import { userRoleSchema, e164PhoneSchema } from '@project-braids/shared-types/api';

/** Internal user shape — includes password_hash; never expose via API. */
export const internalUserSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  phoneNumber: e164PhoneSchema,
  email: z.string().email().nullable(),
  passwordHash: z.string().nullable(),
  phoneVerifiedAt: z.date().nullable(),
  emailVerifiedAt: z.date().nullable(),
  deactivatedAt: z.date().nullable(),
});

export type InternalUser = z.infer<typeof internalUserSchema>;
