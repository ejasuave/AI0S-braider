import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { initSentry, Sentry } from './lib/sentry.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1.js';
import { ApiError } from './lib/errors.js';
import { isApiError, sendApiError } from './lib/http.js';

export async function buildApp() {
  initSentry();
  const env = getEnv();
  const logger = createLogger();

  const app = Fastify({
    loggerInstance: logger,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(sensible);

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: '/api/v1' });

  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      sendApiError(reply, error);
      return;
    }

    Sentry.captureException(error, {
      extra: { url: request.url, method: request.method },
    });
    request.log.error({ err: error }, 'Unhandled error');

    sendApiError(reply, ApiError.internal());
  });

  return app;
}
