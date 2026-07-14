import type { Job } from 'bullmq';
import { prisma } from '../lib/db.js';
import { createLogger } from '../lib/logger.js';
import { calendarSyncService } from '../modules/calendar/sync.js';

const logger = createLogger();

export async function processCalendarReconcileJob(_job: Job): Promise<{
  businesses: number;
  flagged: number;
  retriedDeletions: number;
  renewedSubscriptions: number;
}> {
  const connections = await prisma.calendarConnection.findMany({
    select: { businessId: true },
  });

  let flagged = 0;
  let retriedDeletions = 0;
  let renewedSubscriptions = 0;

  for (const connection of connections) {
    const result = await calendarSyncService.reconcileBusinessCalendar(connection.businessId);
    flagged += result.flagged;
    retriedDeletions += result.retriedDeletions;
    if (result.renewedSubscription) {
      renewedSubscriptions += 1;
    }
  }

  logger.info(
    {
      job: 'calendar.reconcile',
      businesses: connections.length,
      flagged,
      retriedDeletions,
      renewedSubscriptions,
    },
    'Calendar reconciliation sweep complete',
  );

  return {
    businesses: connections.length,
    flagged,
    retriedDeletions,
    renewedSubscriptions,
  };
}
