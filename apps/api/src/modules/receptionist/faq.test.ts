import { describe, expect, it } from 'vitest';
import { ESCALATION_REASONS, type ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { shouldEscalate } from './escalation.js';
import {
  enrichFaqClientMessage,
  filterSlotsForTimePreference,
  isHoursFaqQuestion,
  isServicesListQuestion,
  looksLikeAvailabilityPreference,
  parseTimeOfDayPreference,
  shouldRunPricingLookup,
} from './faq.js';
import { advanceBookingFlow } from './flow.js';
import type { ConversationTurnContext, SessionMemory } from './context.js';

function turn(partial: Partial<ReceptionistTurnOutput>): ReceptionistTurnOutput {
  return {
    intent: 'faq',
    extracted_slots: {},
    confidence: 0.95,
    next_action: 'answer_faq',
    client_message: 'Here are our styles.',
    ...partial,
  };
}

function emptyMemory(overrides: Partial<SessionMemory> = {}): SessionMemory {
  return {
    clientName: null,
    stylistBusinessName: 'Test Salon',
    styleName: null,
    sizeTier: null,
    lengthTier: null,
    quotedPrice: null,
    quotedDurationMinutes: null,
    priceAlreadyQuoted: false,
    addonNames: [],
    addonsConfirmed: false,
    preferredDate: null,
    selectedSlotIndex: null,
    selectedSlotStart: null,
    bookingId: null,
    bookingStatus: 'none',
    lastAiNextAction: null,
    clarificationStreak: 0,
    channel: 'web',
    idleGapMinutes: null,
    ...overrides,
  };
}

function faqContext(overrides: Partial<ConversationTurnContext> = {}): ConversationTurnContext {
  return {
    conversationId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    stylistId: '33333333-3333-4333-8333-333333333333',
    channel: 'web',
    status: 'active',
    timezone: 'Europe/London',
    nowIso: '2026-08-03T10:00:00.000Z',
    messages: [],
    mergedSlots: {},
    sessionMemory: emptyMemory(),
    stylistContext: {
      businessName: 'Test Salon',
      locationArea: 'Peckham',
      workingHoursSummary: 'Mon–Fri 09:00–17:00',
      offerings: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          styleName: 'Knotless braids',
          sizeTier: 'Medium',
          lengthTier: 'Waist-length',
          basePrice: '120',
          estimatedDurationMinutes: 240,
          isCustomStyle: false,
          requirements: ['Hair washed and blow-dried'],
          addons: [],
        },
      ],
      cancellationPolicy: {},
      depositPolicy: {},
      remainingBalanceMethod: 'bank_transfer',
      policyNotes: {
        cancellationWindowHours: 48,
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
    latestClientMessage: 'What styles do you do?',
    priceAlreadyQuoted: false,
    lastAiNextAction: null,
    clarificationStreak: 0,
    ...overrides,
  };
}

describe('FAQ catalogue helpers', () => {
  it('detects services-list and hours questions', () => {
    expect(isServicesListQuestion('What styles do you do?')).toBe(true);
    expect(isServicesListQuestion('what services do you offer')).toBe(true);
    expect(isHoursFaqQuestion('What are your hours?')).toBe(true);
    expect(isHoursFaqQuestion('when are you free for an appointment')).toBe(false);
  });

  it('does not run pricing lookup for FAQ actions', () => {
    expect(shouldRunPricingLookup('answer_faq')).toBe(false);
    expect(shouldRunPricingLookup('ask_clarification')).toBe(false);
    expect(shouldRunPricingLookup('confirm_style_price')).toBe(true);
    expect(shouldRunPricingLookup('propose_slots')).toBe(true);
  });

  it('enriches services-list FAQ with authoritative offerings', () => {
    const message = enrichFaqClientMessage(faqContext(), 'Sure — here’s what we do.');
    expect(message).toContain('Knotless braids');
    expect(message).toContain('£120');
    expect(message).toMatch(/Which style/i);
  });

  it('enriches hours FAQ from working hours summary', () => {
    const message = enrichFaqClientMessage(
      faqContext({ latestClientMessage: 'What are your hours?' }),
      'Happy to help.',
    );
    expect(message).toContain('Mon–Fri 09:00–17:00');
  });
});

describe('services-list FAQ does not escalate on bogus styleName', () => {
  it('forces answer_faq and preserves prior style memory', () => {
    const result = advanceBookingFlow(
      turn({
        extracted_slots: { styleName: 'Totally Fake Style' },
        next_action: 'confirm_style_price',
        client_message: 'We offer many styles.',
      }),
      faqContext({
        latestClientMessage: 'What styles do you do?',
        mergedSlots: { styleName: 'Knotless braids', sizeTier: 'Medium' },
        sessionMemory: emptyMemory({ styleName: 'Knotless braids', sizeTier: 'Medium' }),
      }),
    );

    expect(result.next_action).toBe('answer_faq');
    expect(result.intent).toBe('faq');
    expect(result.extracted_slots.styleName).toBe('Knotless braids');
  });

  it('shouldEscalate stays false when FAQ skip means customStyleUnresolvable is not set', () => {
    const decision = shouldEscalate(turn({ extracted_slots: { styleName: 'Fake' } }), {
      customStyleUnresolvable: false,
      pricingConfidence: undefined,
      latestClientMessage: 'What styles do you do?',
    });
    expect(decision.escalate).toBe(false);
    expect(decision.reason).not.toBe(ESCALATION_REASONS.customStyleUnresolvable);
  });
});

describe('later / earlier availability preferences', () => {
  it('detects later-times questions', () => {
    expect(looksLikeAvailabilityPreference('do you have any later times')).toBe(true);
    expect(parseTimeOfDayPreference('do you have any later times')).toBe('later');
  });

  it('filters proposed slots to later than the previous offer', () => {
    const filtered = filterSlotsForTimePreference({
      preference: 'later',
      timeZone: 'Europe/London',
      previousProposed: [{ startTime: '2026-07-31T08:30:00.000Z' }],
      slots: [
        { startTime: '2026-07-31T08:00:00.000Z' },
        { startTime: '2026-07-31T08:15:00.000Z' },
        { startTime: '2026-07-31T08:30:00.000Z' },
        { startTime: '2026-07-31T11:00:00.000Z' },
        { startTime: '2026-07-31T14:00:00.000Z' },
      ],
    });
    expect(filtered.map((slot) => slot.startTime)).toEqual([
      '2026-07-31T11:00:00.000Z',
      '2026-07-31T14:00:00.000Z',
    ]);
  });
});
