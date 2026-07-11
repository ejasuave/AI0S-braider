import { describe, expect, it } from 'vitest';
import type { ConversationTurnContext } from './context.js';
import { advanceBookingFlow, parsePreferredDateFromText } from './flow.js';

function baseContext(overrides: Partial<ConversationTurnContext> = {}): ConversationTurnContext {
  return {
    conversationId: 'conv-1',
    stylistId: 'stylist-1',
    clientId: 'client-1',
    channel: 'sms',
    status: 'active',
    timezone: 'Europe/London',
    nowIso: '2026-07-11T09:00:00.000Z',
    messages: [],
    mergedSlots: {},
    stylistContext: {
      businessName: 'Test',
      locationArea: null,
      offerings: [],
      cancellationPolicy: null,
      depositPolicy: null,
    },
    proposedSlots: [],
    pendingBookingId: null,
    latestClientMessage: '',
    priceAlreadyQuoted: false,
    lastAiNextAction: null,
    ...overrides,
  };
}

describe('advanceBookingFlow', () => {
  it('upgrades repeat confirm_style_price to propose_slots when price was quoted', () => {
    const result = advanceBookingFlow(
      {
        intent: 'new_booking',
        extracted_slots: { styleName: 'Box braids' },
        confidence: 0.9,
        next_action: 'confirm_style_price',
        client_message: 'Great — I can help with Box braids.',
      },
      baseContext({
        latestClientMessage: 'can you book me in please',
        priceAlreadyQuoted: true,
        mergedSlots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
      }),
    );

    expect(result.next_action).toBe('propose_slots');
  });

  it('creates hold when client picks a proposed slot number', () => {
    const result = advanceBookingFlow(
      {
        intent: 'slot_selection',
        extracted_slots: {},
        confidence: 0.9,
        next_action: 'ask_clarification',
        client_message: 'Sure',
      },
      baseContext({
        latestClientMessage: '1',
        proposedSlots: [
          { index: 1, startTime: '2026-07-12T09:00:00.000Z', endTime: '2026-07-12T10:30:00.000Z' },
        ],
        mergedSlots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
      }),
    );

    expect(result.next_action).toBe('create_hold');
    expect(result.extracted_slots.selectedSlotIndex).toBe(1);
  });
});

describe('parsePreferredDateFromText', () => {
  it('parses weekday names relative to now', () => {
    const saturday = parsePreferredDateFromText(
      'box braids on saturday at 11pm',
      new Date('2026-07-11T09:00:00.000Z'),
    );
    expect(saturday).toBe('2026-07-11');
  });
});
