/** Ch.3.6 — per-endpoint auth rate limits (do not weaken OTP 5/hour from 3.2). */
export const AUTH_RATE_LIMITS = {
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  OTP_REQUEST: { limit: 5, windowMs: 60 * 60 * 1000 },
  PASSWORD_RESET: { limit: 5, windowMs: 60 * 60 * 1000 },
  OAUTH_CALLBACK: { limit: 20, windowMs: 60 * 1000 },
} as const;

export const PASSWORD_RESET_EXPIRY_MS = 30 * 60 * 1000;
