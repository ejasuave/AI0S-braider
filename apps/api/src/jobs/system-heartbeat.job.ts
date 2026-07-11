import type { Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';

const logger = createLogger();

/** Ch.2.5 proof-of-concept — recurring heartbeat (~60s) when worker is running. */
export async function processSystemHeartbeatJob(_job: Job): Promise<{ ok: true }> {
  logger.info({ job: 'system.heartbeat' }, 'Worker heartbeat');
  return { ok: true };
}
