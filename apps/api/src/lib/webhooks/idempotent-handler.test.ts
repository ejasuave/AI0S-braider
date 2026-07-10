import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processWebhookIdempotently } from './idempotent-handler.js';

vi.mock('../db.js', () => ({
  prisma: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../db.js';

describe('processWebhookIdempotently', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a new event and records it', async () => {
    vi.mocked(prisma.processedWebhookEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.processedWebhookEvent.create).mockResolvedValue({
      eventId: 'evt_123',
      source: 'example',
      processedAt: new Date(),
    });

    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await processWebhookIdempotently({
      eventId: 'evt_123',
      source: 'example',
      handler,
    });

    expect(result.status).toBe('processed');
    expect(result.result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(prisma.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_123', source: 'example' },
    });
  });

  it('skips handler for duplicate events', async () => {
    vi.mocked(prisma.processedWebhookEvent.findUnique).mockResolvedValue({
      eventId: 'evt_dup',
      source: 'example',
      processedAt: new Date(),
    });

    const handler = vi.fn();

    const result = await processWebhookIdempotently({
      eventId: 'evt_dup',
      source: 'example',
      handler,
    });

    expect(result.status).toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
  });
});
