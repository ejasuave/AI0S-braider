import type { Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';

const logger = createLogger();

export type ExampleDelayedJobData = {
  message: string;
};

/** Ch.2.5 proof-of-concept — on-demand job with enqueue delay (reminder pattern). */
export async function processExampleDelayedJob(job: Job<ExampleDelayedJobData>): Promise<void> {
  logger.info(
    { job: 'system.example-delayed', message: job.data.message, delay: job.opts.delay },
    'Delayed example job executed',
  );
}
