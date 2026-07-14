import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from './redis.js';
import { getEnv } from '../config/env.js';
import { processExamplePingJob } from '../jobs/example-ping.job.js';
import { processExampleDelayedJob } from '../jobs/example-delayed.job.js';
import { processSystemHeartbeatJob } from '../jobs/system-heartbeat.job.js';
import {
  processBookingExpireHoldJob,
  processBookingSweepHoldsJob,
} from '../jobs/booking-expire-hold.job.js';
import {
  processNotificationDeliverJob,
  processNotificationSweepDueJob,
  processNotificationSweepRemindersJob,
} from '../jobs/notification-sweep.job.js';
import { processInstagramTokenRefreshJob } from '../jobs/instagram-token-refresh.job.js';
import { processCalendarReconcileJob } from '../jobs/calendar-reconcile.job.js';

export const QUEUE_NAMES = {
  SYSTEM: 'system',
} as const;

export const JOB_NAMES = {
  SYSTEM_HEARTBEAT: 'system.heartbeat',
  EXAMPLE_PING: 'system.example-ping',
  EXAMPLE_DELAYED: 'system.example-delayed',
  BOOKING_EXPIRE_HOLD: 'booking.expire-hold',
  BOOKING_SWEEP_HOLDS: 'booking.sweep-expired-holds',
  NOTIFICATION_DELIVER: 'notifications.deliver',
  NOTIFICATION_SWEEP_DUE: 'notifications.sweep-due',
  NOTIFICATION_SWEEP_REMINDERS: 'notifications.sweep-reminders',
  INSTAGRAM_REFRESH_TOKENS: 'instagram.refresh-tokens',
  CALENDAR_RECONCILE: 'calendar.reconcile',
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

export async function scheduleRecurringJobs(): Promise<void> {
  const env = getEnv();
  const queue = getSystemQueue();

  await queue.add(
    JOB_NAMES.SYSTEM_HEARTBEAT,
    {},
    {
      repeat: { every: 60_000 },
      jobId: 'recurring-system-heartbeat',
    },
  );

  await queue.add(
    JOB_NAMES.NOTIFICATION_SWEEP_DUE,
    {},
    {
      repeat: { every: env.NOTIFICATION_SWEEP_INTERVAL_MS },
      jobId: 'recurring-notifications-sweep-due',
    },
  );

  await queue.add(
    JOB_NAMES.NOTIFICATION_SWEEP_REMINDERS,
    {},
    {
      repeat: { every: env.NOTIFICATION_SWEEP_INTERVAL_MS },
      jobId: 'recurring-notifications-sweep-reminders',
    },
  );

  await queue.add(
    JOB_NAMES.INSTAGRAM_REFRESH_TOKENS,
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: 'recurring-instagram-refresh-tokens',
    },
  );

  await queue.add(
    JOB_NAMES.BOOKING_SWEEP_HOLDS,
    {},
    {
      repeat: { every: 60_000 },
      jobId: 'recurring-booking-sweep-holds',
    },
  );

  await queue.add(
    JOB_NAMES.CALENDAR_RECONCILE,
    {},
    {
      repeat: { every: 30 * 60 * 1000 },
      jobId: 'recurring-calendar-reconcile',
    },
  );
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
        case JOB_NAMES.SYSTEM_HEARTBEAT:
          return processSystemHeartbeatJob(job);
        case JOB_NAMES.EXAMPLE_PING:
          return processExamplePingJob(job);
        case JOB_NAMES.EXAMPLE_DELAYED:
          return processExampleDelayedJob(job);
        case JOB_NAMES.BOOKING_EXPIRE_HOLD:
          return processBookingExpireHoldJob(job);
        case JOB_NAMES.BOOKING_SWEEP_HOLDS:
          return processBookingSweepHoldsJob();
        case JOB_NAMES.NOTIFICATION_DELIVER:
          return processNotificationDeliverJob(job);
        case JOB_NAMES.NOTIFICATION_SWEEP_DUE:
          return processNotificationSweepDueJob();
        case JOB_NAMES.NOTIFICATION_SWEEP_REMINDERS:
          return processNotificationSweepRemindersJob();
        case JOB_NAMES.INSTAGRAM_REFRESH_TOKENS:
          return processInstagramTokenRefreshJob(job);
        case JOB_NAMES.CALENDAR_RECONCILE:
          return processCalendarReconcileJob(job);
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    },
    { connection: getRedisConnectionOptions() },
  );
}
