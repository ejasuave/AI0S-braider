import type { FastifyPluginAsync } from 'fastify';
import type { DbHealthResponse, HealthResponse } from '@project-braids/shared-types';
import { prisma } from '../lib/db.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
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
};
