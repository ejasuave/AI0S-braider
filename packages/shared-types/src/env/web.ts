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

function isStagingWebSurface(env: WebEnv): boolean {
  const display = env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME;
  const apiUrl = env.NEXT_PUBLIC_API_URL;
  const sentryEnv = env.SENTRY_ENVIRONMENT?.toLowerCase();
  return display.includes('(Staging)') || apiUrl.includes('staging') || sentryEnv === 'staging';
}

/**
 * Staging must stay on Stripe test keys so pilots cannot take real card payments
 * by accidentally wiring `pk_live_` into Vercel.
 * Clear the live key (disable Stripe.js) rather than crashing the whole app shell.
 */
export function parseWebEnv(input: Record<string, string | undefined>): WebEnv {
  const env = webEnvSchema.parse(input);
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (isStagingWebSurface(env) && publishable?.startsWith('pk_live_')) {
    if (typeof console !== 'undefined') {
      console.error(
        '[env] Staging web must use Stripe test mode (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…). ' +
          'Ignoring pk_live_. See docs/STAGING_SETUP.md §6.',
      );
    }
    return { ...env, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined };
  }
  return env;
}
