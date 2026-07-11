import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import {
  assertRateLimit,
  buildRateLimitKey,
  normalizeIpAddress,
} from '../../lib/security/rate-limit.js';
import { AUTH_RATE_LIMITS } from './auth-rate-limits.js';
import { identityService } from './service.js';
import { getDeviceMetadata, isWebClient, setRefreshCookie } from './middleware.js';

type OAuthProvider = 'google' | 'apple';

type PendingOAuthState = {
  provider: OAuthProvider;
  codeVerifier: string;
  redirectUri: string;
};

const pendingStates = new Map<string, PendingOAuthState>();

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function createCodeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function storeOAuthState(state: string, value: PendingOAuthState): void {
  pendingStates.set(state, value);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
}

function consumeOAuthState(state: string): PendingOAuthState | undefined {
  const value = pendingStates.get(state);
  pendingStates.delete(state);
  return value;
}

export async function startOAuthFlow(
  request: FastifyRequest<{ Params: { provider: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const provider = request.params.provider as OAuthProvider;
  if (provider !== 'google') {
    throw ApiError.notFound('OAuth provider not supported for redirect flow');
  }

  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) {
    throw ApiError.serviceUnavailable('Google OAuth is not configured');
  }

  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = createCodeChallenge(codeVerifier);
  const state = base64Url(randomBytes(16));
  const redirectUri = `${env.API_PUBLIC_URL}/api/v1/auth/oauth/google/callback`;

  storeOAuthState(state, { provider, codeVerifier, redirectUri });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  void reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function handleOAuthCallback(
  request: FastifyRequest<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await assertRateLimit(
    buildRateLimitKey('oauth-callback', normalizeIpAddress(request.ip)),
    AUTH_RATE_LIMITS.OAUTH_CALLBACK.limit,
    AUTH_RATE_LIMITS.OAUTH_CALLBACK.windowMs,
    'Too many OAuth attempts from this address.',
  );

  const provider = request.params.provider as OAuthProvider;
  const { code, state } = request.query;

  if (!code || !state) {
    throw new ApiError('VALIDATION_ERROR', 'Missing OAuth callback parameters', 400);
  }

  const pending = consumeOAuthState(state);
  if (!pending || pending.provider !== provider) {
    throw new ApiError('UNAUTHORIZED', 'Invalid or expired OAuth state', 401);
  }

  if (provider === 'google') {
    const session = await identityService.loginWithGoogle({
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
      deviceMetadata: getDeviceMetadata(request),
    });

    if (isWebClient(request)) {
      setRefreshCookie(reply, session.refreshToken);
    }

    const env = getEnv();
    void reply.redirect(`${env.WEB_APP_URL}/stylist`);
    return;
  }

  throw ApiError.notFound('OAuth provider not supported');
}

export function resetOAuthStateForTests(): void {
  pendingStates.clear();
}
