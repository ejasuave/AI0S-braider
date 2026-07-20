import { describe, expect, it } from 'vitest';
import type { Message } from '@prisma/client';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import {
  buildSessionMemory,
  countClarificationStreak,
  formatWorkingHoursSummary,
  mergeSlotsFromMessages,
  selectMessagesForPrompt,
} from './context.js';
import { extractStyleFromMessages } from './flow.js';

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
      aiMessage(
        {
          extracted_slots: {
            styleName: 'Knotless braids',
            serviceOfferingId: '11111111-1111-4111-8111-111111111111',
            selectedSlotIndex: 2,
            bookingId: '22222222-2222-4222-8222-222222222222',
            quotedPrice: '120',
            addonNames: ['Boho curls'],
          },
        },
        0,
      ),
      aiMessage({ extracted_slots: { styleName: 'Cornrows' } }, 1),
    ]);
    expect(merged.styleName).toBe('Cornrows');
    expect(merged.serviceOfferingId).toBeUndefined();
    expect(merged.selectedSlotIndex).toBeUndefined();
    expect(merged.bookingId).toBeUndefined();
    expect(merged.quotedPrice).toBeUndefined();
    expect(merged.addonNames).toBeUndefined();
  });

  it('merges client name, add-ons, and booking status', () => {
    const merged = mergeSlotsFromMessages([
      aiMessage(
        {
          extracted_slots: {
            styleName: 'Knotless braids',
            clientName: 'Aisha',
            quotedPrice: '120',
            quotedDurationMinutes: 240,
            bookingStatus: 'quoting',
          },
        },
        0,
      ),
      aiMessage(
        {
          extracted_slots: {
            sizeTier: 'Medium',
            addonNames: ['Boho curls'],
            bookingStatus: 'slots_offered',
          },
        },
        1,
      ),
    ]);
    expect(merged).toEqual({
      styleName: 'Knotless braids',
      clientName: 'Aisha',
      quotedPrice: '120',
      quotedDurationMinutes: 240,
      sizeTier: 'Medium',
      addonNames: ['Boho curls'],
      bookingStatus: 'slots_offered',
    });
  });

  it('clears quoted price when size tier changes', () => {
    const merged = mergeSlotsFromMessages([
      aiMessage(
        {
          extracted_slots: {
            styleName: 'Knotless braids',
            sizeTier: 'Large',
            quotedPrice: '120',
            serviceOfferingId: '11111111-1111-4111-8111-111111111111',
          },
        },
        0,
      ),
      aiMessage({ extracted_slots: { styleName: 'Knotless braids', sizeTier: 'Medium' } }, 1),
    ]);
    expect(merged.sizeTier).toBe('Medium');
    expect(merged.quotedPrice).toBeUndefined();
    expect(merged.serviceOfferingId).toBeUndefined();
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

describe('conversation context slot enrichment', () => {
  it('loses style from client text when only truncated messages are searched', () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({
      sender: 'client' as const,
      content: index === 0 ? 'I want box braids please' : `follow up ${index}`,
      createdAt: `2026-07-10T10:${String(index).padStart(2, '0')}:00.000Z`,
    }));

    expect(extractStyleFromMessages(messages)).toBe('Box braids');

    const truncated = selectMessagesForPrompt(messages, 12);
    expect(extractStyleFromMessages(truncated)).toBeUndefined();
  });
});

describe('buildSessionMemory', () => {
  it('summarises active booking context for the prompt', () => {
    const memory = buildSessionMemory({
      mergedSlots: {
        styleName: 'Knotless braids',
        sizeTier: 'Large',
        quotedPrice: '120',
        addonNames: ['Boho curls'],
        bookingStatus: 'quoting',
      },
      stylistBusinessName: 'Ch13 Braids',
      clientDisplayName: 'Aisha',
      priceAlreadyQuoted: true,
      lastAiNextAction: 'confirm_style_price',
      clarificationStreak: 1,
      idleGapMinutes: 45,
      channel: 'web',
    });

    expect(memory.clientName).toBe('Aisha');
    expect(memory.styleName).toBe('Knotless braids');
    expect(memory.addonNames).toEqual(['Boho curls']);
    expect(memory.idleGapMinutes).toBe(45);
    expect(memory.channel).toBe('web');
  });
});

describe('countClarificationStreak', () => {
  it('counts trailing ask_clarification turns without slot progress', () => {
    const streak = countClarificationStreak([
      aiMessage({ next_action: 'ask_clarification', extracted_slots: {} }, 0),
      aiMessage({ next_action: 'ask_clarification', extracted_slots: {} }, 1),
      aiMessage({ next_action: 'ask_clarification', extracted_slots: {} }, 2),
    ]);
    expect(streak).toBe(3);
  });

  it('resets when a clarification turn extracts a style', () => {
    const streak = countClarificationStreak([
      aiMessage({ next_action: 'ask_clarification', extracted_slots: {} }, 0),
      aiMessage(
        { next_action: 'ask_clarification', extracted_slots: { styleName: 'Box braids' } },
        1,
      ),
    ]);
    expect(streak).toBe(0);
  });
});

describe('formatWorkingHoursSummary', () => {
  it('formats enabled and closed days', () => {
    const summary = formatWorkingHoursSummary({
      monday: { enabled: true, start: '09:00', end: '18:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    });
    expect(summary).toContain('monday: 09:00–18:00');
    expect(summary).toContain('sunday: closed');
  });
});
