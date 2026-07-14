import { describe, expect, it, afterEach } from 'vitest';
import { realtimeHub } from './hub.js';

describe('realtimeHub', () => {
  afterEach(() => {
    realtimeHub.resetForTests();
  });

  it('delivers published events to subscribers for the same stylist', () => {
    const received: string[] = [];
    const unsubscribe = realtimeHub.subscribe('stylist-1', (event) => {
      received.push(event.type);
    });

    realtimeHub.publish('stylist-1', {
      type: 'booking_created',
      data: { bookingId: 'b-1', status: 'held' },
    });

    expect(received).toEqual(['booking_created']);
    unsubscribe();
  });

  it('does not deliver events to other stylists', () => {
    const received: string[] = [];
    realtimeHub.subscribe('stylist-1', (event) => {
      received.push(event.type);
    });

    realtimeHub.publish('stylist-2', {
      type: 'conversation_escalated',
      data: { conversationId: 'c-1', reason: 'test' },
    });

    expect(received).toEqual([]);
  });

  it('stops delivering after unsubscribe', () => {
    const received: string[] = [];
    const unsubscribe = realtimeHub.subscribe('stylist-1', (event) => {
      received.push(event.type);
    });

    unsubscribe();

    realtimeHub.publish('stylist-1', {
      type: 'conversation_message',
      data: { conversationId: 'c-1', messageId: 'm-1' },
    });

    expect(received).toEqual([]);
  });
});
