import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  PLATFORM_DISPLAY_NAME: z.string().default('Project Braids'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_REFRESH_NAME: z.string().default('pb_refresh_token'),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_WEBHOOK_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  OTP_MAX_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  BOOKING_HOLD_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  PLATFORM_TIMEZONE: z.string().default('Europe/London'),
  AVAILABILITY_SLOT_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  AVAILABILITY_MAX_DAYS: z.coerce.number().int().positive().max(90).default(60),
  STRIPE_SECRET_KEY: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().optional(),
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().optional(),
  ),
  STRIPE_CONNECT_RETURN_URL: z.string().url().default('http://localhost:3000/stylist/payments'),
  STRIPE_CONNECT_REFRESH_URL: z.string().url().default('http://localhost:3000/stylist/payments'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  MESSAGING_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  MESSAGING_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  /**
   * Founder staging override: `openai_compatible` (e.g. Groq) when Anthropic has no credits.
   * Production default remains `anthropic` (Blueprint).
   */
  AI_PROVIDER: z.enum(['anthropic', 'openai_compatible']).default('anthropic'),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  OPENAI_COMPAT_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  OPENAI_COMPAT_MODEL: z.string().default('llama-3.3-70b-versatile'),
  AI_RECEPTIONIST_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  AI_RECEPTIONIST_MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(12),
  NOTIFICATION_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  NOTIFICATION_ACTIVE_CONVERSATION_DEFERRAL_MINUTES: z.coerce.number().int().positive().default(30),
  GIT_SHA: z.string().optional(),
  APP_VERSION: z.string().default('0.0.0'),
  DEPLOY_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  OPS_BEARER_TOKEN: z.string().min(16).optional(),
  /** When set, staff invites (and other transactional email) send via Resend. */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(input: Record<string, string | undefined>): ApiEnv {
  return apiEnvSchema.parse(input);
}
