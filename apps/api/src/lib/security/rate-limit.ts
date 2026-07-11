import { getEnv } from '../../config/env.js';
import { ApiError } from '../errors.js';
import { getRedis } from '../redis.js';

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type WindowEntry = {
  count: number;
  resetAt: number;
};

const inMemoryWindows = new Map<string, WindowEntry>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.trim();
}

export function normalizeIpAddress(ip: string | undefined): string {
  return (ip ?? 'unknown').trim();
}

export function buildRateLimitKey(namespace: string, value: string): string {
  return `auth:rl:${namespace}:${value}`;
}

async function incrementRedis(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }
  const ttlMs = await redis.pttl(key);
  return { count, ttlMs: ttlMs > 0 ? ttlMs : windowMs };
}

function incrementMemory(key: string, windowMs: number): { count: number; ttlMs: number } {
  const now = Date.now();
  const existing = inMemoryWindows.get(key);
  if (!existing || now >= existing.resetAt) {
    inMemoryWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, ttlMs: windowMs };
  }
  existing.count += 1;
  return { count: existing.count, ttlMs: existing.resetAt - now };
}

/** Ch.3.6 — reusable Redis-backed rate limiter (in-memory in dev/test). */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const env = getEnv();
  let count: number;
  let ttlMs: number;

  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
    ({ count, ttlMs } = incrementMemory(key, windowMs));
  } else {
    try {
      ({ count, ttlMs } = await incrementRedis(key, windowMs));
    } catch {
      ({ count, ttlMs } = incrementMemory(key, windowMs));
    }
  }

  if (count <= limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
  };
}

export async function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const result = await checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new ApiError('RATE_LIMITED', message, 429, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

export function resetRateLimitsForTests(): void {
  inMemoryWindows.clear();
}
