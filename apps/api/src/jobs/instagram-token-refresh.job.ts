import type { Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import { instagramService } from '../modules/stylist-profile/instagram.service.js';

const logger = createLogger();

export async function processInstagramTokenRefreshJob(_job: Job): Promise<{ refreshed: number }> {
  const refreshed = await instagramService.refreshExpiringTokens(24);
  logger.info({ job: 'instagram.refresh-tokens', refreshed }, 'Instagram token refresh sweep');
  return { refreshed };
}
