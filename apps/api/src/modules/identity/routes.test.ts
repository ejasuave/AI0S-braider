import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { getLastDevOtp, clearLastDevOtp } from '../../lib/sms/sms-provider.js';

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
    if (!databaseAvailable) return;
    clearLastDevOtp();
    await prisma.session.deleteMany();
    await prisma.otpChallenge.deleteMany();
    await prisma.user.deleteMany({ where: { email: stylist.email } });
    await prisma.user.deleteMany({ where: { phoneNumber: stylist.phoneNumber } });
    await prisma.otpChallenge.deleteMany({ where: { phoneNumber: '+447700900202' } });
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
