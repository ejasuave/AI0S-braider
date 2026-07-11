import type { FastifyPluginAsync } from 'fastify';
import type { DbHealthResponse, HealthResponse } from '@project-braids/shared-types';
import { getEnv } from '../config/env.js';
import { prisma } from '../lib/db.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const env = getEnv();
    void reply.send({
      service: 'api',
      status: 'ok',
      message:
        'This is the Project Braids API. Use the web app for the UI, or call /api/v1 endpoints.',
      webAppUrl: env.WEB_APP_URL,
      endpoints: {
        health: '/health',
        dbHealth: '/health/db',
        apiPing: '/api/v1/ping',
        opsStatus: '/api/v1/system/ops-status',
      },
    });
  });

  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/health/db', async (): Promise<DbHealthResponse> => {
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      app.log.error({ err: error }, 'Database health check failed');
      return {
        status: 'error',
        database: 'disconnected',
        error: message,
      };
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/health/error-test', async () => {
      throw new Error('Deliberate observability test error (Ch.1.8)');
    });
  }
};
