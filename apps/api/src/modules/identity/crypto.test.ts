import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  hashOtpCode,
  hashPassword,
  hashRefreshToken,
  verifyOtpCode,
  verifyPassword,
} from './crypto.js';

describe('identity crypto', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Password1');
    expect(await verifyPassword('Password1', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('generates and verifies OTP codes', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = hashOtpCode(code);
    expect(verifyOtpCode(code, hash)).toBe(true);
    expect(verifyOtpCode('000000', hash)).toBe(false);
  });

  it('hashes refresh tokens deterministically', () => {
    expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
  });
});
