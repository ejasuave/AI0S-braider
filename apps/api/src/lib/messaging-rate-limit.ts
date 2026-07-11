import { getEnv } from '../config/env.js';
import { ApiError } from './errors.js';
import { getRedis } from './redis.js';

type WindowEntry = {
  count: number;
  resetAt: number;
};

const inMemoryWindows = new Map<string, WindowEntry>();

function getWindowKey(phoneNumber: string): string {
  return `messaging:${phoneNumber}`;
}

async function incrementRedis(key: string, windowMs: number, max: number): Promise<boolean> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }
  return count <= max;
}

function incrementMemory(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const existing = inMemoryWindows.get(key);
  if (!existing || now >= existing.resetAt) {
    inMemoryWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  existing.count += 1;
  return existing.count <= max;
}

/** Ch.13.7 — throttle inbound SMS per client phone to limit abuse/cost exposure. */
export async function assertInboundMessagingAllowed(phoneNumber: string): Promise<void> {
  const env = getEnv();
  const key = getWindowKey(phoneNumber);
  const windowMs = env.MESSAGING_RATE_LIMIT_WINDOW_MS;
  const max = env.MESSAGING_RATE_LIMIT_MAX;

  let allowed: boolean;
  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
    allowed = incrementMemory(key, windowMs, max);
  } else {
    try {
      allowed = await incrementRedis(key, windowMs, max);
    } catch {
      // Redis unavailable — degrade to in-memory rather than blocking inbound SMS.
      allowed = incrementMemory(key, windowMs, max);
    }
  }

  if (!allowed) {
    throw new ApiError(
      'RATE_LIMITED',
      'Too many messages in a short period. Please wait before sending again.',
      429,
    );
  }
}

export function resetMessagingRateLimitForTests(): void {
  inMemoryWindows.clear();
}
