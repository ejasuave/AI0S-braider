import type { FastifyReply, FastifyRequest } from 'fastify';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '@project-braids/shared-types/api';
import { verifyAccessToken } from './tokens.js';
import { identityService } from './service.js';
import { resolveBusinessId, resolveStylistId } from './auth-context.js';
import { impersonationService } from '../roles/impersonation.service.js';

export type AuthenticatedRequest = FastifyRequest & {
  auth: AuthContext;
};

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHORIZED', 'Missing or invalid authorization header', 401);
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = await verifyAccessToken(token);
    let auth: AuthContext;

    if (payload.imp === true && typeof payload.admin_sub === 'string') {
      auth = await impersonationService.buildAuthFromImpersonationToken({
        sub: payload.sub,
        role: payload.role,
        sid: payload.sid,
        imp: true,
        admin_sub: payload.admin_sub,
      });
    } else {
      const user = await identityService.getUserById(payload.sub);
      if (!user) {
        throw new ApiError('UNAUTHORIZED', 'User not found', 401);
      }

      auth = {
        user,
        sessionId: payload.sid,
        stylistId: await resolveStylistId(user.id, user.role),
        businessId: await resolveBusinessId(user.id, user.role),
        impersonation: null,
      };
    }

    (request as AuthenticatedRequest).auth = {
      ...auth,
      impersonation: auth.impersonation ?? null,
    };

    if (auth.impersonation) {
      request.log.info(
        {
          event: 'impersonated_request',
          adminUserId: auth.impersonation.adminUserId,
          targetUserId: auth.impersonation.targetUserId,
          impersonationSessionId: auth.impersonation.sessionId,
          method: request.method,
          url: request.url,
        },
        'Impersonated API request',
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('UNAUTHORIZED', 'Invalid or expired access token', 401);
  }
}

export function getDeviceMetadata(request: FastifyRequest): Record<string, unknown> {
  return {
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  };
}

export function isWebClient(request: FastifyRequest): boolean {
  return request.headers['x-client-type'] === 'web';
}

export function setRefreshCookie(reply: FastifyReply, refreshToken: string): void {
  const env = getEnv();
  const maxAge = env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;

  void reply.setCookie(env.COOKIE_REFRESH_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  const env = getEnv();
  void reply.clearCookie(env.COOKIE_REFRESH_NAME, { path: '/api/v1/auth' });
}

export function getRefreshTokenFromRequest(request: FastifyRequest): string | undefined {
  const env = getEnv();
  const fromCookie = request.cookies[env.COOKIE_REFRESH_NAME];
  if (fromCookie) return fromCookie;

  const body = request.body as { refreshToken?: string } | undefined;
  return body?.refreshToken;
}
