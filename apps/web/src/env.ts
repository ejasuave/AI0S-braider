import { parseWebEnv, type WebEnv } from '@project-braids/shared-types/env';

let cachedEnv: WebEnv | undefined;

export function getWebEnv(): WebEnv {
  if (!cachedEnv) {
    cachedEnv = parseWebEnv({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_PLATFORM_DISPLAY_NAME: process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      SENTRY_DSN: process.env.SENTRY_DSN,
      SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    });
  }
  return cachedEnv;
}
