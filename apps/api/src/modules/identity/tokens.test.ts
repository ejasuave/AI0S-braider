import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './tokens.js';

describe('access tokens', () => {
  it('signs and verifies JWT access tokens', async () => {
    const { token, expiresIn } = await signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'stylist_owner',
      sessionId: '22222222-2222-2222-2222-222222222222',
    });

    expect(expiresIn).toBeGreaterThan(0);

    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.role).toBe('stylist_owner');
    expect(payload.sid).toBe('22222222-2222-2222-2222-222222222222');
  });
});
