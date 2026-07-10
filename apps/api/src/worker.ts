import { createSystemWorker } from './lib/queue.js';
import { createLogger } from './lib/logger.js';
import { getEnv } from './config/env.js';
import { initSentry } from './lib/sentry.js';
import { closeRedis } from './lib/redis.js';
import { closeQueues } from './lib/queue.js';
import { prisma } from './lib/db.js';

async function startWorker(): Promise<void> {
  initSentry();
  getEnv();
  const logger = createLogger();

  const worker = createSystemWorker();

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, name: job?.name, err: error }, 'Job failed');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker');
    await worker.close();
    await closeQueues();
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('Background worker listening for jobs');
}

void startWorker();
