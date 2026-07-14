import { z } from 'zod';

export const webEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_PLATFORM_DISPLAY_NAME: z.string().default('Project Braids'),
  /** Stripe publishable key (`pk_test_` or `pk_live_`) — enables deposit checkout UI. */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  /** Google OAuth client ID — enables real Calendar connect from `/stylist/calendar`. */
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(input: Record<string, string | undefined>): WebEnv {
  return webEnvSchema.parse(input);
}
