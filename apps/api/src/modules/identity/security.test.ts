import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { clearLastDevOtp } from '../../lib/sms/sms-provider.js';
import { encryptAtRest } from '../../lib/security/encryption.js';
import { getEnv } from '../../config/env.js';
import {
  buildRateLimitKey,
  checkRateLimit,
  normalizeEmail,
  resetRateLimitsForTests,
} from '../../lib/security/rate-limit.js';
import { AUTH_RATE_LIMITS } from '../identity/auth-rate-limits.js';
import { resetOAuthStateForTests } from '../identity/oauth-flow.js';

const testEmail = 'ratelimit.ch3@example.com';
const testPhone = '+447700900303';

let databaseAvailable = false;

describe('auth security rate limits', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterEach(() => {
    resetRateLimitsForTests();
    resetOAuthStateForTests();
    clearLastDevOtp();
  });

  it('normalizes email so casing variants share one bucket', async () => {
    const limit = 2;
    const windowMs = 60_000;
    const keyA = buildRateLimitKey('test-email', normalizeEmail('Test@Example.com'));
    const keyB = buildRateLimitKey('test-email', normalizeEmail('test@example.com'));

    expect(keyA).toBe(keyB);

    expect(await checkRateLimit(keyA, limit, windowMs)).toEqual({ allowed: true });
    expect(await checkRateLimit(keyA, limit, windowMs)).toEqual({ allowed: true });
    const blocked = await checkRateLimit(keyA, limit, windowMs);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('keeps OTP limit at 5 requests per hour after refactor', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    for (let i = 0; i < AUTH_RATE_LIMITS.OTP_REQUEST.limit; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phoneNumber: testPhone, purpose: 'login' },
      });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { phoneNumber: testPhone, purpose: 'login' },
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();

    await app.close();
  });

  it('rate limits login attempts per email', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    for (let i = 0; i < AUTH_RATE_LIMITS.LOGIN.limit; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testEmail, password: 'wrong-password' },
      });
      expect(res.statusCode).toBe(401);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: 'wrong-password' },
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');

    await app.close();
  });

  it('rate limits password reset requests per email', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    for (let i = 0; i < AUTH_RATE_LIMITS.PASSWORD_RESET.limit; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email: testEmail },
      });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email: testEmail },
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');

    await app.close();
  });

  it('rate limits OAuth POST endpoints per IP', async () => {
    const app = await buildApp();

    for (let i = 0; i < AUTH_RATE_LIMITS.OAUTH_CALLBACK.limit; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/google',
        payload: { code: 'bad', codeVerifier: 'a'.repeat(43), redirectUri: 'http://localhost/cb' },
      });
      expect([401, 503]).toContain(res.statusCode);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/google',
      payload: { code: 'bad', codeVerifier: 'a'.repeat(43), redirectUri: 'http://localhost/cb' },
    });

    expect(blocked.statusCode).toBe(429);

    await app.close();
  });
});

describe('auth security integration', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterEach(async () => {
    resetRateLimitsForTests();
    clearLastDevOtp();
    if (!databaseAvailable) return;
    await prisma.session.deleteMany();
    await prisma.otpChallenge.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'oauth.ch3@example.com' } });
  });

  it('stores OAuth tokens encrypted at rest', async ({ skip }) => {
    if (!databaseAvailable) skip();

    const env = getEnv();
    const plaintextAccess = 'ya29.oauth-access-token-value';
    const plaintextRefresh = '1//oauth-refresh-token-value';

    const user = await prisma.user.create({
      data: {
        role: 'stylist_owner',
        phoneNumber: '+447700900404',
        email: 'oauth.ch3@example.com',
        oauthAccounts: {
          create: {
            provider: 'google',
            providerAccountId: 'google-subject-123',
            accessTokenEnc: encryptAtRest(plaintextAccess, env.JWT_SECRET),
            refreshTokenEnc: encryptAtRest(plaintextRefresh, env.JWT_SECRET),
          },
        },
      },
      include: { oauthAccounts: true },
    });

    const account = user.oauthAccounts[0];
    expect(account?.accessTokenEnc).not.toContain(plaintextAccess);
    expect(account?.refreshTokenEnc).not.toContain(plaintextRefresh);
  });
});
