import { prisma } from '../db.js';

export type WebhookSource = 'stripe' | 'twilio' | 'example';

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
  });
  return existing !== null;
}

export async function markWebhookProcessed(
  eventId: string,
  source: WebhookSource,
): Promise<void> {
  await prisma.processedWebhookEvent.create({
    data: { eventId, source },
  });
}

export type IdempotentWebhookOptions<T> = {
  eventId: string;
  source: WebhookSource;
  handler: () => Promise<T>;
};

/**
 * Four-step idempotent webhook sequence (Ch.2.6):
 * 1. Caller verifies signature before invoking
 * 2. Dedupe via processed_webhook_events
 * 3. Execute handler
 * 4. Record event as processed
 */
export async function processWebhookIdempotently<T>(
  options: IdempotentWebhookOptions<T>,
): Promise<{ status: 'processed' | 'duplicate'; result?: T }> {
  if (await isWebhookProcessed(options.eventId)) {
    return { status: 'duplicate' };
  }

  const result = await options.handler();

  try {
    await markWebhookProcessed(options.eventId, options.source);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return { status: 'duplicate' };
    }
    throw error;
  }

  return { status: 'processed', result };
}
