import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from './redis.js';
import { processExamplePingJob } from '../jobs/example-ping.job.js';

export const QUEUE_NAMES = {
  SYSTEM: 'system',
} as const;

export const JOB_NAMES = {
  EXAMPLE_PING: 'system.example-ping',
} as const;

let systemQueue: Queue | undefined;

export function getSystemQueue(): Queue {
  if (!systemQueue) {
    systemQueue = new Queue(QUEUE_NAMES.SYSTEM, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return systemQueue;
}

export async function closeQueues(): Promise<void> {
  if (systemQueue) {
    await systemQueue.close();
    systemQueue = undefined;
  }
}

export function createSystemWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.SYSTEM,
    async (job: Job) => {
      switch (job.name) {
        case JOB_NAMES.EXAMPLE_PING:
          return processExamplePingJob(job);
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    },
    { connection: getRedisConnectionOptions() },
  );
}
