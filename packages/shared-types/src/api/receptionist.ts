import { z } from 'zod';

export const RECEPTIONIST_INTENTS = [
  'new_booking',
  'reschedule',
  'faq',
  'slot_selection',
  'dispute',
  'complaint',
  'out_of_scope',
  'prompt_injection',
  'general',
] as const;

export type ReceptionistIntent = (typeof RECEPTIONIST_INTENTS)[number];

export const RECEPTIONIST_NEXT_ACTIONS = [
  'ask_clarification',
  'confirm_style_price',
  'propose_slots',
  'create_hold',
  'send_deposit_link',
  'answer_faq',
  'escalate',
  'noop',
] as const;

export type ReceptionistNextAction = (typeof RECEPTIONIST_NEXT_ACTIONS)[number];

/** Claude often returns `""` for unused optional tool fields — treat as omitted. */
function emptyToUndefined(value: unknown): unknown {
  if (value === null || value === '') return undefined;
  return value;
}

const optionalNonEmptyString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

export const extractedSlotsSchema = z.object({
  styleName: optionalNonEmptyString,
  sizeTier: optionalNonEmptyString,
  lengthTier: optionalNonEmptyString,
  preferredDate: optionalNonEmptyString,
  selectedSlotStart: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  selectedSlotIndex: z.preprocess(
    (value) => (value === null || value === '' || value === 0 ? undefined : value),
    z.number().int().min(1).max(9).optional(),
  ),
  serviceOfferingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  bookingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export type ExtractedSlots = z.infer<typeof extractedSlotsSchema>;

export const receptionistTurnOutputSchema = z.object({
  intent: z.enum(RECEPTIONIST_INTENTS),
  extracted_slots: extractedSlotsSchema.default({}),
  confidence: z.number().min(0).max(1),
  next_action: z.enum(RECEPTIONIST_NEXT_ACTIONS),
  client_message: z.string().trim().min(1).max(1600),
  escalation_reason: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
});

export type ReceptionistTurnOutput = z.infer<typeof receptionistTurnOutputSchema>;

export const CONFIDENCE_THRESHOLD = 0.8;

/** Standard escalation reason strings (Ch.13.6) — used in DB and stylist notifications. */
export const ESCALATION_REASONS = {
  structuredOutputValidationFailed: 'structured_output_validation_failed',
  confidenceBelowThreshold: 'confidence_below_threshold',
  intentRequiresHuman: 'intent_requires_human_review',
  customStyleUnresolvable: 'custom_style_unresolvable',
  ambiguousSlotSelection: 'ambiguous_slot_selection',
  promptInjection: 'prompt_injection',
  pricingLookupLowConfidence: 'pricing_lookup_low_confidence',
  killSwitch: 'kill_switch',
  smsOptOut: 'sms_opt_out',
  dispatchFailed: 'dispatch_failed',
  aiProviderUnavailable: 'ai_provider_unavailable',
} as const;

export type EscalationReason = (typeof ESCALATION_REASONS)[keyof typeof ESCALATION_REASONS];

export const ALWAYS_ESCALATE_INTENTS = [
  'dispute',
  'complaint',
  'out_of_scope',
  'prompt_injection',
] as const satisfies readonly ReceptionistIntent[];
