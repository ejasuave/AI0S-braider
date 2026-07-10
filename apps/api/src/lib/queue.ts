import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from './redis.js';
import { processExamplePingJob } from '../jobs/example-ping.job.js';
import {
  processBookingExpireHoldJob,
  processBookingSweepHoldsJob,
} from '../jobs/booking-expire-hold.job.js';

export const QUEUE_NAMES = {
  SYSTEM: 'system',
} as const;

export const JOB_NAMES = {
  EXAMPLE_PING: 'system.example-ping',
  BOOKING_EXPIRE_HOLD: 'booking.expire-hold',
  BOOKING_SWEEP_HOLDS: 'booking.sweep-expired-holds',
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
        case JOB_NAMES.BOOKING_EXPIRE_HOLD:
          return processBookingExpireHoldJob(job);
        case JOB_NAMES.BOOKING_SWEEP_HOLDS:
          return processBookingSweepHoldsJob();
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    },
    { connection: getRedisConnectionOptions() },
  );
}
