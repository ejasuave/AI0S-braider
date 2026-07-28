import { describe, expect, it } from 'vitest';
import type { ConversationTurnContext, SessionMemory } from './context.js';
import {
  advanceBookingFlow,
  composeHumanBookingReply,
  inferBookingPhase,
  isNonBookingTopicTurn,
  parsePreferredDateFromText,
  wasPriceAlreadyQuoted,
} from './flow.js';
import { looksLikeAvailabilityPreference } from './faq.js';

function emptySessionMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    clientName: null,
    stylistBusinessName: 'Test',
    styleName: null,
    sizeTier: null,
    lengthTier: null,
    quotedPrice: null,
    quotedDurationMinutes: null,
    addonNames: [],
    addonsConfirmed: false,
    preferredDate: null,
    selectedSlotIndex: null,
    selectedSlotStart: null,
    bookingId: null,
    bookingStatus: 'none',
    priceAlreadyQuoted: false,
    lastAiNextAction: null,
    clarificationStreak: 0,
    idleGapMinutes: null,
    channel: 'sms',
    ...overrides,
  };
}

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
    sessionMemory: emptySessionMemory(),
    stylistContext: {
      businessName: 'Test',
      locationArea: null,
      workingHoursSummary: 'monday: 09:00–18:00',
      offerings: [],
      cancellationPolicy: null,
      depositPolicy: null,
      remainingBalanceMethod: 'cash_or_card',
      policyNotes: {
        cancellationWindowHours: 24,
        cancellationPolicyText: null,
        reschedulingPolicyText: null,
        depositPolicyText: null,
        childrenPolicyText: null,
        guestPolicyText: null,
        refundPolicyText: null,
        lateArrivalPolicyText: null,
        noShowPolicyText: null,
      },
    },
    proposedSlots: [],
    pendingBookingId: null,
    latestClientMessage: '',
    priceAlreadyQuoted: false,
    lastAiNextAction: null,
    clarificationStreak: 0,
    ...overrides,
  };
}

const repeatPriceOutput = {
  intent: 'new_booking' as const,
  extracted_slots: { styleName: 'Box braids' },
  confidence: 0.9,
  next_action: 'confirm_style_price' as const,
  client_message:
    'Great — I can help with Box braids. Let me confirm pricing and find times for you.',
};

describe('advanceBookingFlow', () => {
  it('upgrades repeat confirm_style_price to propose_slots when price was quoted', () => {
    const result = advanceBookingFlow(
      repeatPriceOutput,
      baseContext({
        latestClientMessage: 'can you book me in please',
        priceAlreadyQuoted: true,
        lastAiNextAction: 'confirm_style_price',
        mergedSlots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        messages: [
          {
            sender: 'client',
            content: 'box braids on saturday',
            createdAt: '2026-07-11T09:00:00.000Z',
          },
          {
            sender: 'ai',
            content: 'Box braids: £20, about 90 mins.',
            createdAt: '2026-07-11T09:01:00.000Z',
          },
        ],
      }),
    );

    expect(result.next_action).toBe('propose_slots');
    expect(result.client_message).toMatch(/Finding open times|open times/i);
    expect(result.client_message).not.toMatch(/confirm pricing/i);
  });

  it('quotes price once when style is known but price not yet shared', () => {
    const result = advanceBookingFlow(
      repeatPriceOutput,
      baseContext({
        latestClientMessage: 'box braids please, how much',
        mergedSlots: {},
        messages: [{ sender: 'client', content: 'box braids please, how much', createdAt: '' }],
      }),
    );

    expect(result.next_action).toBe('confirm_style_price');
    expect(result.client_message).toMatch(/pricing|is:/i);
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
        priceAlreadyQuoted: true,
      }),
    );

    expect(result.next_action).toBe('create_hold');
    expect(result.extracted_slots.selectedSlotIndex).toBe(1);
  });

  it('extracts style from earlier client messages when slots are empty', () => {
    const result = advanceBookingFlow(
      repeatPriceOutput,
      baseContext({
        latestClientMessage: 'okay can you book me in',
        priceAlreadyQuoted: true,
        lastAiNextAction: 'confirm_style_price',
        messages: [
          { sender: 'client', content: 'box braids on saturday', createdAt: '' },
          { sender: 'ai', content: 'Box braids: £20, about 90 mins.', createdAt: '' },
        ],
      }),
    );

    expect(result.next_action).toBe('propose_slots');
    expect(result.extracted_slots.styleName).toBe('Box braids');
  });

  it('preserves FAQ model reply during an active booking thread', () => {
    const faqOutput = {
      intent: 'faq' as const,
      extracted_slots: { styleName: 'Knotless braids', sizeTier: 'Large' },
      confidence: 0.95,
      next_action: 'answer_faq' as const,
      client_message: "We're in Peckham — exact address comes after you confirm.",
    };

    const result = advanceBookingFlow(
      faqOutput,
      baseContext({
        latestClientMessage: 'Actually, where are you located?',
        priceAlreadyQuoted: true,
        mergedSlots: { styleName: 'Knotless braids', sizeTier: 'Large', quotedPrice: '120' },
      }),
    );

    expect(result.next_action).toBe('answer_faq');
    expect(result.intent).toBe('faq');
    expect(result.client_message).toContain('Peckham');
    expect(result.extracted_slots.styleName).toBe('Knotless braids');
  });

  it('blocks propose_slots until add-ons are confirmed', () => {
    const result = advanceBookingFlow(
      {
        intent: 'new_booking',
        extracted_slots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        confidence: 0.9,
        next_action: 'propose_slots',
        client_message: 'Finding times',
      },
      baseContext({
        latestClientMessage: 'book me in',
        priceAlreadyQuoted: true,
        mergedSlots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        stylistContext: {
          businessName: 'Test',
          locationArea: null,
          workingHoursSummary: 'monday: 09:00–18:00',
          offerings: [
            {
              id: 'off-1',
              styleName: 'Box braids',
              sizeTier: null,
              lengthTier: null,
              basePrice: '80',
              estimatedDurationMinutes: 180,
              isCustomStyle: false,
              requirements: [],
              addons: [{ id: 'addon-1', name: 'Boho curls', price: '25' }],
            },
          ],
          cancellationPolicy: null,
          depositPolicy: null,
          remainingBalanceMethod: 'cash_or_card',
          policyNotes: {
            cancellationWindowHours: 24,
            cancellationPolicyText: null,
            reschedulingPolicyText: null,
            depositPolicyText: null,
            childrenPolicyText: null,
            guestPolicyText: null,
            refundPolicyText: null,
            lateArrivalPolicyText: null,
            noShowPolicyText: null,
          },
        },
      }),
    );

    expect(result.next_action).toBe('ask_clarification');
    expect(result.client_message).toMatch(/add-ons/i);
  });

  it('treats none as add-ons confirmed and allows propose_slots', () => {
    const result = advanceBookingFlow(
      {
        intent: 'new_booking',
        extracted_slots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        confidence: 0.9,
        next_action: 'propose_slots',
        client_message: 'Finding times',
      },
      baseContext({
        latestClientMessage: 'none',
        priceAlreadyQuoted: true,
        mergedSlots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        stylistContext: {
          businessName: 'Test',
          locationArea: null,
          workingHoursSummary: 'monday: 09:00–18:00',
          offerings: [
            {
              id: 'off-1',
              styleName: 'Box braids',
              sizeTier: null,
              lengthTier: null,
              basePrice: '80',
              estimatedDurationMinutes: 180,
              isCustomStyle: false,
              requirements: [],
              addons: [{ id: 'addon-1', name: 'Boho curls', price: '25' }],
            },
          ],
          cancellationPolicy: null,
          depositPolicy: null,
          remainingBalanceMethod: 'cash_or_card',
          policyNotes: {
            cancellationWindowHours: 24,
            cancellationPolicyText: null,
            reschedulingPolicyText: null,
            depositPolicyText: null,
            childrenPolicyText: null,
            guestPolicyText: null,
            refundPolicyText: null,
            lateArrivalPolicyText: null,
            noShowPolicyText: null,
          },
        },
      }),
    );

    expect(result.extracted_slots.addonsConfirmed).toBe(true);
    expect(result.next_action).toBe('propose_slots');
  });
});

describe('isNonBookingTopicTurn', () => {
  it('treats location and payment questions as non-booking', () => {
    expect(
      isNonBookingTopicTurn(
        {
          intent: 'faq',
          extracted_slots: {},
          confidence: 0.9,
          next_action: 'answer_faq',
          client_message: 'In Peckham',
        },
        'where are you located?',
      ),
    ).toBe(true);

    expect(
      isNonBookingTopicTurn(
        {
          intent: 'general',
          extracted_slots: {},
          confidence: 0.9,
          next_action: 'answer_faq',
          client_message: 'Yes, bank transfer',
        },
        'do you accept bank transfer?',
      ),
    ).toBe(true);
  });
});

describe('inferBookingPhase', () => {
  it('detects propose_slots after price quoted and booking request', () => {
    const phase = inferBookingPhase(
      baseContext({
        latestClientMessage: 'can you book me in for that please',
        priceAlreadyQuoted: true,
        lastAiNextAction: 'confirm_style_price',
        mergedSlots: { styleName: 'Box braids' },
      }),
      { styleName: 'Box braids' },
    );

    expect(phase).toBe('propose_slots');
  });
});

describe('composeHumanBookingReply', () => {
  it('responds directly to a booking request instead of repeating pricing intro', () => {
    const reply = composeHumanBookingReply(
      'propose_slots',
      baseContext({
        latestClientMessage: 'Can you book me in for that please',
        mergedSlots: { styleName: 'Box braids' },
        priceAlreadyQuoted: true,
      }),
      { styleName: 'Box braids' },
    );

    expect(reply).toMatch(/Finding open times|open times/i);
    expect(reply).not.toMatch(/confirm pricing/i);
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

describe('wasPriceAlreadyQuoted', () => {
  it('ignores catalogue FAQ prices that only appear in message text', () => {
    expect(
      wasPriceAlreadyQuoted(
        [
          {
            sender: 'ai',
            content: 'Here is what we offer:\n\n• Box Braids: £30.00, about 2h',
            structuredOutput: {
              intent: 'faq',
              extracted_slots: {},
              confidence: 0.9,
              next_action: 'answer_faq',
              client_message: 'Here is what we offer',
            },
          },
        ],
        {},
      ),
    ).toBe(false);
  });

  it('detects an explicit confirm_style_price turn', () => {
    expect(
      wasPriceAlreadyQuoted(
        [
          {
            sender: 'ai',
            content: 'Box Braids: £30.00, about 2h',
            structuredOutput: {
              intent: 'new_booking',
              extracted_slots: { styleName: 'Box Braids', quotedPrice: '30.00' },
              confidence: 0.9,
              next_action: 'confirm_style_price',
              client_message: 'Box Braids: £30.00, about 2h',
            },
          },
        ],
        {},
      ),
    ).toBe(true);
  });
});

describe('availability preference vs slot pick', () => {
  it('recognises thursday time-window questions', () => {
    expect(
      looksLikeAvailabilityPreference('is there any times on thursday between 10 and 1'),
    ).toBe(true);
  });

  it('re-proposes slots for thursday preference instead of create_hold', () => {
    const result = advanceBookingFlow(
      {
        intent: 'slot_selection',
        extracted_slots: { styleName: 'Box braids', serviceOfferingId: 'off-1' },
        confidence: 0.9,
        next_action: 'create_hold',
        client_message: 'Booking that for you',
      },
      baseContext({
        latestClientMessage: 'is there any times on thursday between 10 and 1',
        priceAlreadyQuoted: true,
        mergedSlots: {
          styleName: 'Box braids',
          serviceOfferingId: 'off-1',
          quotedPrice: '30.00',
          addonsConfirmed: true,
        },
        proposedSlots: [
          { index: 1, startTime: '2026-07-29T08:00:00.000Z', endTime: '2026-07-29T10:00:00.000Z' },
          { index: 2, startTime: '2026-07-29T08:15:00.000Z', endTime: '2026-07-29T10:15:00.000Z' },
        ],
        nowIso: '2026-07-28T21:00:00.000Z',
      }),
    );

    expect(result.next_action).toBe('propose_slots');
    expect(result.extracted_slots.preferredDate).toBe('2026-07-30');
    expect(result.extracted_slots.selectedSlotIndex).toBeUndefined();
  });
});
