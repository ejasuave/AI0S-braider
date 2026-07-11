import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getEnv } from '../../config/env.js';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthUser } from '@project-braids/shared-types/api';
import { identityService } from '../identity/service.js';
import { resolveStylistId } from '../identity/auth-context.js';
import { businessService } from './business.service.js';

const IMPERSONATION_EXPIRY_SECONDS = 300;

export type ImpersonationAccessTokenPayload = JWTPayload & {
  sub: string;
  role: string;
  sid: string;
  imp: true;
  admin_sub: string;
};

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signImpersonationAccessToken(input: {
  targetUserId: string;
  targetRole: string;
  adminUserId: string;
  impersonationSessionId: string;
}): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({
    role: input.targetRole,
    sid: input.impersonationSessionId,
    imp: true,
    admin_sub: input.adminUserId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.targetUserId)
    .setIssuedAt()
    .setExpirationTime(`${IMPERSONATION_EXPIRY_SECONDS}s`)
    .sign(getSecretKey());

  return { token, expiresIn: IMPERSONATION_EXPIRY_SECONDS };
}

export async function verifyImpersonationAccessToken(
  token: string,
): Promise<ImpersonationAccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });

  if (
    !payload.sub ||
    typeof payload.role !== 'string' ||
    typeof payload.sid !== 'string' ||
    payload.imp !== true ||
    typeof payload.admin_sub !== 'string'
  ) {
    throw new Error('Invalid impersonation token payload');
  }

  return payload as ImpersonationAccessTokenPayload;
}

export function isImpersonationPayload(payload: JWTPayload): payload is ImpersonationAccessTokenPayload {
  return payload.imp === true && typeof payload.admin_sub === 'string';
}

export class ImpersonationService {
  async startSession(input: {
    adminUserId: string;
    targetUserId: string;
    reason: string;
    createdFromIp: string;
  }): Promise<{
    accessToken: string;
    expiresIn: number;
    impersonationSessionId: string;
    targetUser: AuthUser;
    adminUserId: string;
  }> {
    if (input.adminUserId === input.targetUserId) {
      throw new ApiError('VALIDATION_ERROR', 'Cannot impersonate yourself', 400);
    }

    const targetUser = await identityService.getUserById(input.targetUserId);
    if (!targetUser) {
      throw ApiError.notFound('Target user not found');
    }

    const session = await prisma.impersonationSession.create({
      data: {
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        reason: input.reason,
        createdFromIp: input.createdFromIp,
      },
    });

    const { token, expiresIn } = await signImpersonationAccessToken({
      targetUserId: targetUser.id,
      targetRole: targetUser.role,
      adminUserId: input.adminUserId,
      impersonationSessionId: session.id,
    });

    return {
      accessToken: token,
      expiresIn,
      impersonationSessionId: session.id,
      targetUser,
      adminUserId: input.adminUserId,
    };
  }

  async endSession(input: { sessionId: string; adminUserId: string }): Promise<void> {
    const session = await prisma.impersonationSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session || session.adminUserId !== input.adminUserId) {
      throw ApiError.notFound('Impersonation session not found');
    }

    if (!session.endedAt) {
      await prisma.impersonationSession.update({
        where: { id: session.id },
        data: { endedAt: new Date() },
      });
    }
  }

  async buildAuthFromImpersonationToken(payload: ImpersonationAccessTokenPayload) {
    const session = await prisma.impersonationSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.endedAt) {
      throw new ApiError('UNAUTHORIZED', 'Impersonation session ended', 401);
    }

    const user = await identityService.getUserById(payload.sub);
    if (!user) {
      throw new ApiError('UNAUTHORIZED', 'Target user not found', 401);
    }

    const stylistId = await resolveStylistId(user.id, user.role);
    const businessId = await businessService.resolveBusinessIdForUser(user.id, user.role);

    return {
      user,
      sessionId: payload.sid,
      stylistId,
      businessId,
      impersonation: {
        sessionId: payload.sid,
        adminUserId: payload.admin_sub,
        targetUserId: payload.sub,
      },
    };
  }
}

export const impersonationService = new ImpersonationService();
