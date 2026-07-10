import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getEnv } from '../../config/env.js';

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  role: string;
  sid: string;
};

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAccessToken(payload: {
  userId: string;
  role: string;
  sessionId: string;
}): Promise<{ token: string; expiresIn: number }> {
  const env = getEnv();
  const expiresIn = env.JWT_ACCESS_EXPIRY_SECONDS;

  const token = await new SignJWT({
    role: payload.role,
    sid: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getSecretKey());

  return { token, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ['HS256'],
  });

  if (!payload.sub || typeof payload.role !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Invalid access token payload');
  }

  return payload as AccessTokenPayload;
}
