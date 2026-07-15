import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { initSentry, Sentry } from './lib/sentry.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1.js';
import { ApiError } from './lib/errors.js';
import { resolveCorsOrigin } from './lib/cors.js';
import { isDatabaseUnavailableError } from './lib/db-errors.js';
import { isApiError, isZodError, sendApiError } from './lib/http.js';

export async function buildApp() {
  initSentry();
  const env = getEnv();
  const logger = createLogger();

  const app = Fastify({
    loggerInstance: logger,
    requestIdHeader: 'x-request-id',
    genReqId: (request) =>
      (request.headers['x-request-id'] as string | undefined) ??
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  });

  await app.register(cors, {
    origin: resolveCorsOrigin(env),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(cookie);
  await app.register(sensible);

  app.setErrorHandler((error, request, reply) => {
    if (isZodError(error)) {
      const firstIssue = error.issues[0];
      const path = firstIssue?.path?.length ? firstIssue.path.join('.') : null;
      const message = firstIssue
        ? path
          ? `${path}: ${firstIssue.message}`
          : firstIssue.message
        : 'Validation failed';
      sendApiError(reply, ApiError.validation(message, error.flatten()));
      return;
    }

    if (isApiError(error)) {
      sendApiError(reply, error);
      return;
    }

    if (isDatabaseUnavailableError(error)) {
      const message =
        env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
          ? 'Database is unavailable. From the project root run `pnpm infra:up`, then restart `pnpm dev`.'
          : 'Database is temporarily unavailable. Please try again shortly.';
      sendApiError(reply, ApiError.serviceUnavailable(message));
      return;
    }

    Sentry.captureException(error, {
      extra: { url: request.url, method: request.method },
    });
    request.log.error({ err: error }, 'Unhandled error');

    sendApiError(reply, ApiError.internal());
  });

  if (env.NODE_ENV !== 'test') {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    await mkdir(uploadsRoot, { recursive: true });
    await app.register(fastifyStatic, {
      root: uploadsRoot,
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: '/api/v1' });

  return app;
}
