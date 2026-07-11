import { describe, expect, it } from 'vitest';
import type { Message } from '@prisma/client';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import {
  mergeSlotsFromMessages,
  selectMessagesForPrompt,
} from './context.js';

function aiMessage(output: Partial<ReceptionistTurnOutput>, index: number): Message {
  const full: ReceptionistTurnOutput = {
    intent: 'new_booking',
    extracted_slots: {},
    confidence: 0.9,
    next_action: 'ask_clarification',
    client_message: 'Hello',
    ...output,
  };
  return {
    id: `msg-${index}`,
    conversationId: 'conv-1',
    sender: 'ai',
    content: full.client_message,
    structuredOutput: full as unknown as Message['structuredOutput'],
    providerMessageId: null,
    deliveryStatus: null,
    createdAt: new Date(2026, 6, 10, 10, index),
  };
}

describe('mergeSlotsFromMessages', () => {
  it('merges slots across turns with later values overriding', () => {
    const merged = mergeSlotsFromMessages([
      aiMessage({ extracted_slots: { styleName: 'Knotless braids' } }, 0),
      aiMessage({ extracted_slots: { sizeTier: 'Medium' } }, 1),
    ]);
    expect(merged).toEqual({ styleName: 'Knotless braids', sizeTier: 'Medium' });
  });

  it('clears stale pricing/hold slots when style changes mid-conversation', () => {
    const merged = mergeSlotsFromMessages([
      aiMessage({
        extracted_slots: {
          styleName: 'Knotless braids',
          serviceOfferingId: '11111111-1111-4111-8111-111111111111',
          selectedSlotIndex: 2,
          bookingId: '22222222-2222-4222-8222-222222222222',
        },
      }, 0),
      aiMessage({ extracted_slots: { styleName: 'Cornrows' } }, 1),
    ]);
    expect(merged.styleName).toBe('Cornrows');
    expect(merged.serviceOfferingId).toBeUndefined();
    expect(merged.selectedSlotIndex).toBeUndefined();
    expect(merged.bookingId).toBeUndefined();
  });
});

describe('selectMessagesForPrompt', () => {
  it('truncates to the most recent N messages once threshold exceeded', () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      createdAt: `2026-07-10T10:${String(index).padStart(2, '0')}:00.000Z`,
      content: `message-${index}`,
    }));
    const selected = selectMessagesForPrompt(messages, 12);
    expect(selected).toHaveLength(12);
    expect(selected[0]?.content).toBe('message-8');
    expect(selected[11]?.content).toBe('message-19');
  });
});
