import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  accountRecoveryRequestSchema,
  appleOAuthRequestSchema,
  googleOAuthRequestSchema,
  loginRequestSchema,
  otpRequestSchema,
  otpVerifyRequestSchema,
  passwordForgotRequestSchema,
  passwordResetRequestSchema,
  phoneChangeRequestSchema,
  registerClientRequestSchema,
  registerStylistRequestSchema,
  signupRequestSchema,
} from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { identityService } from './service.js';
import { getLastDevOtp } from '../../lib/sms/sms-provider.js';
import {
  authenticate,
  clearRefreshCookie,
  getDeviceMetadata,
  getRefreshTokenFromRequest,
  isWebClient,
  setRefreshCookie,
  type AuthenticatedRequest,
} from './middleware.js';
import { handleOAuthCallback, startOAuthFlow } from './oauth-flow.js';
import {
  assertRateLimit,
  buildRateLimitKey,
  normalizeIpAddress,
} from '../../lib/security/rate-limit.js';
import { AUTH_RATE_LIMITS } from './auth-rate-limits.js';

async function assertOAuthPostRateLimit(request: { ip: string }): Promise<void> {
  await assertRateLimit(
    buildRateLimitKey('oauth-callback', normalizeIpAddress(request.ip)),
    AUTH_RATE_LIMITS.OAUTH_CALLBACK.limit,
    AUTH_RATE_LIMITS.OAUTH_CALLBACK.windowMs,
    'Too many OAuth attempts from this address.',
  );
}

export const identityRoutes: FastifyPluginAsync = async (app) => {
  app.post('/signup', async (request, reply) => {
    const body = signupRequestSchema.parse(request.body);
    if (body.role !== 'stylist_owner') {
      throw new ApiError('VALIDATION_ERROR', 'Only stylist_owner self-service signup is allowed', 400);
    }
    const result = await identityService.registerStylist(body);
    sendData(
      reply,
      { userId: result.userId, otpRequired: true, otpPurpose: result.otpPurpose },
      201,
    );
  });

  app.post('/register/stylist', async (request, reply) => {
    const body = registerStylistRequestSchema.parse(request.body);
    const result = await identityService.registerStylist(body);
    sendData(
      reply,
      { userId: result.userId, otpRequired: true, otpPurpose: result.otpPurpose },
      201,
    );
  });

  app.post('/register/client', async (request, reply) => {
    const body = registerClientRequestSchema.parse(request.body);
    const result = await identityService.registerClient(body);
    sendData(reply, { otpRequired: true, otpPurpose: result.otpPurpose }, 201);
  });

  app.post('/login', async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const session = await identityService.login({
      ...body,
      deviceMetadata: getDeviceMetadata(request),
    });

    if (isWebClient(request)) {
      setRefreshCookie(reply, session.refreshToken);
    }

    sendData(reply, {
      user: session.user,
      tokens: {
        ...session.tokens,
        refreshToken: isWebClient(request) ? undefined : session.refreshToken,
      },
    });
  });

  app.post('/otp/request', async (request, reply) => {
    const body = otpRequestSchema.parse(request.body);
    const result = await identityService.sendOtp(body);
    sendData(reply, { sent: true as const, expiresInSeconds: result.expiresInSeconds });
  });

  app.post('/otp/verify', async (request, reply) => {
    const body = otpVerifyRequestSchema.parse(request.body);
    const result = await identityService.verifyOtp({
      ...body,
      deviceMetadata: getDeviceMetadata(request),
    });

    if ('verified' in result) {
      sendData(reply, { verified: true });
      return;
    }

    if (isWebClient(request)) {
      setRefreshCookie(reply, result.refreshToken);
    }

    sendData(reply, {
      user: result.user,
      tokens: {
        ...result.tokens,
        refreshToken: isWebClient(request) ? undefined : result.refreshToken,
      },
    });
  });

  app.post('/refresh', async (request, reply) => {
    const refreshToken = getRefreshTokenFromRequest(request);
    if (!refreshToken) {
      throw new ApiError('UNAUTHORIZED', 'Refresh token required', 401);
    }

    try {
      const session = await identityService.refreshSession({
        refreshToken,
        deviceMetadata: getDeviceMetadata(request),
      });

      if (isWebClient(request)) {
        setRefreshCookie(reply, session.refreshToken);
      }

      sendData(reply, {
        user: session.user,
        tokens: {
          ...session.tokens,
          refreshToken: isWebClient(request) ? undefined : session.refreshToken,
        },
      });
    } catch (error) {
      await identityService.detectRefreshTokenReuse(refreshToken).catch(() => undefined);
      throw error;
    }
  });

  app.post('/logout', async (request, reply) => {
    const refreshToken = getRefreshTokenFromRequest(request);
    if (refreshToken) {
      await identityService.logout(refreshToken);
    }
    clearRefreshCookie(reply);
    sendData(reply, { loggedOut: true });
  });

  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    sendData(reply, { user: auth.user, stylistId: auth.stylistId, businessId: auth.businessId });
  });

  app.get('/oauth/:provider/start', startOAuthFlow);
  app.get('/oauth/:provider/callback', handleOAuthCallback);

  app.post('/oauth/google', async (request, reply) => {
    await assertOAuthPostRateLimit(request);
    const body = googleOAuthRequestSchema.parse(request.body);
    const session = await identityService.loginWithGoogle({
      ...body,
      deviceMetadata: getDeviceMetadata(request),
    });

    if (isWebClient(request)) {
      setRefreshCookie(reply, session.refreshToken);
    }

    sendData(reply, {
      user: session.user,
      tokens: {
        ...session.tokens,
        refreshToken: isWebClient(request) ? undefined : session.refreshToken,
      },
    });
  });

  app.post('/oauth/apple', async (request, reply) => {
    await assertOAuthPostRateLimit(request);
    const body = appleOAuthRequestSchema.parse(request.body);
    const session = await identityService.loginWithApple({
      ...body,
      deviceMetadata: getDeviceMetadata(request),
    });

    if (isWebClient(request)) {
      setRefreshCookie(reply, session.refreshToken);
    }

    sendData(reply, {
      user: session.user,
      tokens: {
        ...session.tokens,
        refreshToken: isWebClient(request) ? undefined : session.refreshToken,
      },
    });
  });

  const handlePasswordResetRequest = async (request: { body: unknown }, reply: FastifyReply) => {
    const body = passwordForgotRequestSchema.parse(request.body);
    await identityService.requestPasswordReset(body.email);
    sendData(reply, {
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  };

  app.post('/password/forgot', handlePasswordResetRequest);
  app.post('/password-reset/request', handlePasswordResetRequest);

  const handlePasswordResetConfirm = async (request: { body: unknown }, reply: FastifyReply) => {
    const body = passwordResetRequestSchema.parse(request.body);
    await identityService.resetPassword(body.token, body.password);
    sendData(reply, { message: 'Password updated successfully.' });
  };

  app.post('/password/reset', handlePasswordResetConfirm);
  app.post('/password-reset/confirm', handlePasswordResetConfirm);

  app.post('/phone-change/request', { preHandler: authenticate }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = phoneChangeRequestSchema.parse(request.body);
    const result = await identityService.requestPhoneNumberChange({
      userId: auth.user.id,
      requestedPhoneNumber: body.requestedPhoneNumber,
    });
    sendData(reply, { requestId: result.requestId, status: 'pending' as const }, 202);
  });

  app.post('/recovery/request', async (request, reply) => {
    const body = accountRecoveryRequestSchema.parse(request.body);
    const result = await identityService.requestAccountRecovery(body);
    sendData(reply, { requestId: result.requestId, status: 'pending' as const }, 202);
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/dev/last-otp', async (request, reply) => {
      const { phoneNumber } = request.query as { phoneNumber?: string };
      const last = getLastDevOtp();
      if (!last) {
        throw ApiError.notFound('No verification code has been sent yet');
      }
      if (phoneNumber && last.phoneNumber !== phoneNumber) {
        throw ApiError.notFound('No verification code for this phone number');
      }
      sendData(reply, { phoneNumber: last.phoneNumber, code: last.code });
    });
  }
};
