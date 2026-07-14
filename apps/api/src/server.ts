import './load-env.js';
import { buildApp } from './app.js';
import { getEnv } from './config/env.js';
import { prisma } from './lib/db.js';
import {
  isGoogleCalendarMockMode,
  resetGoogleCalendarApiClient,
} from './modules/calendar/google-client.js';

async function start(): Promise<void> {
  resetGoogleCalendarApiClient();
  const env = getEnv();
  const app = await buildApp();

  const stripeMode = !env.STRIPE_SECRET_KEY
    ? 'mock'
    : env.STRIPE_SECRET_KEY.startsWith('sk_live_')
      ? 'live'
      : 'test';
  const googleCalendarMode = isGoogleCalendarMockMode() ? 'mock' : 'live';

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ port: env.PORT, stripeMode, googleCalendarMode }, 'API server listening');

    try {
      await prisma.$queryRaw`SELECT 1`;
      app.log.info('Database connection verified');
    } catch (error) {
      app.log.error(
        { err: error },
        'Database is unavailable — auth and data routes will fail until you run `pnpm infra:up` and restart the API',
      );
    }
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start API server');
    process.exit(1);
  }
}

void start();
