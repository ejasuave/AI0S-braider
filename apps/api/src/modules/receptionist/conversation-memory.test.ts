import { describe, expect, it } from 'vitest';
import type { ConversationTurnContext, SessionMemory } from './context.js';
import { buildSystemPrompt } from './prompt.js';
import { advanceBookingFlow } from './flow.js';
import { shouldEscalate } from './escalation.js';
import { ESCALATION_REASONS } from '@project-braids/shared-types/api';

function emptySessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    clientName: 'Aisha',
    stylistBusinessName: 'Ch13 Braids',
    styleName: 'Knotless braids',
    sizeTier: 'Large',
    lengthTier: null,
    quotedPrice: '120',
    quotedDurationMinutes: 240,
    addonNames: [],
    preferredDate: null,
    selectedSlotIndex: null,
    selectedSlotStart: null,
    bookingId: null,
    bookingStatus: 'quoting',
    priceAlreadyQuoted: true,
    lastAiNextAction: 'confirm_style_price',
    clarificationStreak: 0,
    idleGapMinutes: null,
    channel: 'web',
    ...overrides,
  };
}

function baseContext(overrides: Partial<ConversationTurnContext> = {}): ConversationTurnContext {
  return {
    conversationId: 'conv-1',
    stylistId: 'stylist-1',
    clientId: 'client-1',
    channel: 'web',
    status: 'active',
    timezone: 'Europe/London',
    nowIso: '2026-07-20T12:00:00.000Z',
    messages: [
      {
        sender: 'client',
        content: 'How much are Large Knotless Braids?',
        createdAt: '2026-07-20T11:58:00.000Z',
      },
      {
        sender: 'ai',
        content: 'Large Knotless Braids are £120.',
        createdAt: '2026-07-20T11:58:30.000Z',
      },
    ],
    mergedSlots: {
      styleName: 'Knotless braids',
      sizeTier: 'Large',
      quotedPrice: '120',
      quotedDurationMinutes: 240,
      bookingStatus: 'quoting',
    },
    sessionMemory: emptySessionMemory(),
    stylistContext: {
      businessName: 'Ch13 Braids',
      locationArea: 'Peckham',
      workingHoursSummary: 'monday: 09:00–18:00; saturday: 10:00–16:00; sunday: closed',
      offerings: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          styleName: 'Knotless braids',
          sizeTier: 'Large',
          lengthTier: null,
          basePrice: '120',
          estimatedDurationMinutes: 240,
          isCustomStyle: false,
          requirements: ['Wash hair the night before'],
          addons: [{ name: 'Boho curls', price: '25' }],
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          styleName: 'Knotless braids',
          sizeTier: 'Medium',
          lengthTier: null,
          basePrice: '100',
          estimatedDurationMinutes: 210,
          isCustomStyle: false,
          requirements: [],
          addons: [],
        },
      ],
      cancellationPolicy: null,
      depositPolicy: { type: 'percent', value: 20 },
      remainingBalanceMethod: 'cash_or_bank_transfer',
      policyNotes: {
        cancellationWindowHours: 48,
        cancellationPolicyText: null,
        reschedulingPolicyText: 'Reschedule with 24h notice',
        depositPolicyText: '20% deposit to confirm',
        childrenPolicyText: null,
        guestPolicyText: null,
        refundPolicyText: null,
        lateArrivalPolicyText: null,
        noShowPolicyText: null,
      },
    },
    proposedSlots: [],
    pendingBookingId: null,
    latestClientMessage: 'What about the medium ones?',
    priceAlreadyQuoted: true,
    lastAiNextAction: 'confirm_style_price',
    clarificationStreak: 0,
    ...overrides,
  };
}

describe('conversation memory prompt', () => {
  it('injects session memory and working hours into the system prompt', () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain('SESSION MEMORY');
    expect(prompt).toContain('Knotless braids');
    expect(prompt).toContain('Large');
    expect(prompt).toContain('£120');
    expect(prompt).toContain('Working hours:');
    expect(prompt).toContain('Peckham');
    expect(prompt).toContain('Never say you are an AI');
    expect(prompt).toMatch(/medium ones/i);
  });
});

describe('multi-turn topic switching', () => {
  it('keeps style slots when answering a location FAQ mid-thread', () => {
    const result = advanceBookingFlow(
      {
        intent: 'faq',
        extracted_slots: {},
        confidence: 0.95,
        next_action: 'answer_faq',
        client_message: "We're in Peckham — address after confirmation.",
      },
      baseContext({
        latestClientMessage: 'Actually, where are you located?',
      }),
    );

    expect(result.intent).toBe('faq');
    expect(result.next_action).toBe('answer_faq');
    expect(result.extracted_slots.styleName).toBe('Knotless braids');
    expect(result.extracted_slots.sizeTier).toBe('Large');
    expect(result.client_message).toContain('Peckham');
  });

  it('keeps add-ons when answering a payment FAQ', () => {
    const result = advanceBookingFlow(
      {
        intent: 'faq',
        extracted_slots: { addonNames: ['Boho curls'] },
        confidence: 0.94,
        next_action: 'answer_faq',
        client_message: 'Yes — bank transfer works for the remaining balance.',
      },
      baseContext({
        latestClientMessage: 'And do you accept bank transfer?',
        mergedSlots: {
          styleName: 'Knotless braids',
          sizeTier: 'Medium',
          addonNames: ['Boho curls'],
          quotedPrice: '125',
        },
        sessionMemory: emptySessionMemory({
          sizeTier: 'Medium',
          addonNames: ['Boho curls'],
          quotedPrice: '125',
        }),
      }),
    );

    expect(result.next_action).toBe('answer_faq');
    expect(result.extracted_slots.addonNames).toEqual(['Boho curls']);
  });
});

describe('escalation scenarios in conversation', () => {
  it('escalates cancellation disputes', () => {
    const decision = shouldEscalate(
      {
        intent: 'dispute',
        extracted_slots: { bookingId: '33333333-3333-4333-8333-333333333333' },
        confidence: 0.9,
        next_action: 'escalate',
        client_message: 'Connecting you with the stylist about the refund.',
        escalation_reason: 'Refund dispute',
      },
      { latestClientMessage: 'You charged me wrongly for a cancellation' },
    );
    expect(decision.escalate).toBe(true);
  });

  it('escalates after three stuck clarifications', () => {
    const decision = shouldEscalate(
      {
        intent: 'new_booking',
        extracted_slots: {},
        confidence: 0.9,
        next_action: 'ask_clarification',
        client_message: 'Which style did you want?',
      },
      { clarificationStreak: 3 },
    );
    expect(decision.reason).toBe(ESCALATION_REASONS.repeatedClarificationFailure);
  });
});
