import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { getLastDevOtp, clearLastDevOtp } from '../../lib/sms/sms-provider.js';
import { resetRateLimitsForTests } from '../../lib/security/rate-limit.js';
import { hashResetToken } from './crypto.js';

const stylist = {
  phoneNumber: '+447700900101',
  email: 'stylist.ch3@example.com',
  password: 'Password1',
};

let databaseAvailable = false;

describe('auth routes', () => {
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
    if (!databaseAvailable) return;
    clearLastDevOtp();
    await prisma.session.deleteMany();
    await prisma.otpChallenge.deleteMany();
    await prisma.user.deleteMany({ where: { email: stylist.email } });
    await prisma.user.deleteMany({ where: { phoneNumber: stylist.phoneNumber } });
    await prisma.otpChallenge.deleteMany({ where: { phoneNumber: '+447700900202' } });
  });

  it('returns CONFLICT for duplicate stylist signup', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: stylist,
    });
    expect(first.statusCode).toBe(201);

    const otp = getLastDevOtp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: stylist.phoneNumber,
        code: otp?.code,
        purpose: 'phone_verify',
      },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: stylist,
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('CONFLICT');

    await app.close();
  });

  it('does not create client user until OTP verification', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    const phone = '+447700900202';

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/client',
      payload: { phoneNumber: phone },
    });
    expect(register.statusCode).toBe(201);

    const beforeVerify = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    expect(beforeVerify).toBeNull();

    const otp = getLastDevOtp();
    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { phoneNumber: phone, code: otp?.code, purpose: 'phone_verify' },
    });
    expect(verify.statusCode).toBe(200);

    const afterVerify = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    expect(afterVerify?.role).toBe('client');
    expect(afterVerify?.phoneVerifiedAt).not.toBeNull();

    await prisma.user.deleteMany({ where: { phoneNumber: phone } });
    await app.close();
  });

  it('rejects replay of consumed OTP with distinct error', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();
    const phone = '+447700900303';

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { phoneNumber: phone, purpose: 'login' },
    });

    const otp = getLastDevOtp();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { phoneNumber: phone, code: otp?.code, purpose: 'login' },
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { phoneNumber: phone, code: otp?.code, purpose: 'login' },
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json().error.details?.reason).toBe('OTP_ALREADY_CONSUMED');

    await prisma.user.deleteMany({ where: { phoneNumber: phone } });
    await app.close();
  });

  it('revokes sessions after password reset confirm', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/stylist',
      payload: stylist,
    });

    const otp = getLastDevOtp();
    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: stylist.phoneNumber,
        code: otp?.code,
        purpose: 'phone_verify',
      },
    });
    const refreshToken = verify.json().data.tokens.refreshToken as string;

    const resetToken = 'test-reset-token-ch3';
    const user = await prisma.user.findUnique({ where: { email: stylist.email } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        tokenHash: hashResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/confirm',
      payload: { token: resetToken, password: 'NewPassword1' },
    });
    expect(reset.statusCode).toBe(200);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    await app.close();
  });

  it('registers stylist, verifies OTP, and returns session', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/stylist',
      payload: stylist,
    });
    expect(register.statusCode).toBe(201);

    const otp = getLastDevOtp();
    expect(otp?.phoneNumber).toBe(stylist.phoneNumber);

    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: stylist.phoneNumber,
        code: otp?.code,
        purpose: 'phone_verify',
      },
    });

    expect(verify.statusCode).toBe(200);
    const body = verify.json();
    expect(body.data.user.phoneVerified).toBe(true);
    expect(body.data.tokens.accessToken).toBeDefined();

    await app.close();
  });

  it('logs in with password after phone verification', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/stylist',
      payload: stylist,
    });

    const otp = getLastDevOtp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: stylist.phoneNumber,
        code: otp?.code,
        purpose: 'phone_verify',
      },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: stylist.email,
        password: stylist.password,
      },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().data.tokens.accessToken).toBeDefined();

    await app.close();
  });

  it('rotates refresh tokens and rejects reuse', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register/stylist',
      payload: stylist,
    });

    const otp = getLastDevOtp();
    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phoneNumber: stylist.phoneNumber,
        code: otp?.code,
        purpose: 'phone_verify',
      },
    });

    const refreshToken = verify.json().data.tokens.refreshToken as string;

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    await app.close();
  });

  it('rate limits OTP requests per phone', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const app = await buildApp();

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phoneNumber: '+447700900202', purpose: 'login' },
      });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { phoneNumber: '+447700900202', purpose: 'login' },
    });
    expect(blocked.statusCode).toBe(429);

    await app.close();
  });
});
