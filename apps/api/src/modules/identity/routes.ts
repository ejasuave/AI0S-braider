import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  accountRecoveryRequestSchema,
  appleOAuthRequestSchema,
  googleOAuthRequestSchema,
  loginRequestSchema,
  otpRequestSchema,
  otpVerifyRequestSchema,
  passwordForgotRequestSchema,
  passwordResetRequestSchema,
  registerClientRequestSchema,
  registerStylistRequestSchema,
} from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { getRedis } from '../../lib/redis.js';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import { identityService } from './service.js';
import {
  authenticate,
  clearRefreshCookie,
  getDeviceMetadata,
  getRefreshTokenFromRequest,
  isWebClient,
  setRefreshCookie,
  type AuthenticatedRequest,
} from './middleware.js';

export const identityRoutes: FastifyPluginAsync = async (app) => {
  const env = getEnv();

  await app.register(rateLimit, {
    global: false,
    max: env.AUTH_RATE_LIMIT_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_WINDOW_MS,
    ...(env.NODE_ENV === 'test'
      ? {}
      : { redis: getRedis(), nameSpace: 'auth-rate-limit:' }),
  });

  app.post('/register/stylist', async (request, reply) => {
    const body = registerStylistRequestSchema.parse(request.body);
    const result = await identityService.registerStylist(body);
    sendData(reply, { userId: result.userId, otpRequired: true }, 201);
  });

  app.post('/register/client', async (request, reply) => {
    const body = registerClientRequestSchema.parse(request.body);
    const result = await identityService.registerClient(body);
    sendData(reply, { userId: result.userId, otpRequired: true }, 201);
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
    sendData(reply, { user: auth.user, stylistId: auth.stylistId });
  });

  app.post('/oauth/google', async (request, reply) => {
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

  app.post('/password/forgot', async (request, reply) => {
    const body = passwordForgotRequestSchema.parse(request.body);
    await identityService.requestPasswordReset(body.email);
    sendData(reply, {
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  });

  app.post('/password/reset', async (request, reply) => {
    const body = passwordResetRequestSchema.parse(request.body);
    await identityService.resetPassword(body.token, body.password);
    sendData(reply, { message: 'Password updated successfully.' });
  });

  app.post('/recovery/request', async (request, reply) => {
    const body = accountRecoveryRequestSchema.parse(request.body);
    const result = await identityService.requestAccountRecovery(body);
    sendData(reply, { requestId: result.requestId, status: 'pending' as const }, 202);
  });
};
