import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { initSentry, Sentry } from './lib/sentry.js';
import { healthRoutes } from './routes/health.js';

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

  app.setErrorHandler((error, request, reply) => {
    Sentry.captureException(error, {
      extra: { url: request.url, method: request.method },
    });
    request.log.error({ err: error }, 'Unhandled error');

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Internal Server Error';

    void reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : message,
    });
  });

  return app;
}
