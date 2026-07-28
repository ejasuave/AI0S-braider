/** Shared tool schema for Anthropic + OpenAI-compatible structured receptionist turns. */

export const RECEPTIONIST_TOOL_NAME = 'receptionist_turn';

/** Optional JSON Schema types — Groq models often emit `null` for unused fields. */
const optionalString = { type: ['string', 'null'] } as const;
const optionalNumber = { type: ['number', 'null'] } as const;
const optionalBoolean = { type: ['boolean', 'null'] } as const;
const optionalStringArray = {
  type: ['array', 'null'],
  items: { type: 'string' },
} as const;

export const RECEPTIONIST_TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [
        'new_booking',
        'reschedule',
        'faq',
        'slot_selection',
        'dispute',
        'complaint',
        'out_of_scope',
        'prompt_injection',
        'general',
      ],
    },
    extracted_slots: {
      type: 'object',
      properties: {
        styleName: optionalString,
        sizeTier: optionalString,
        lengthTier: optionalString,
        preferredDate: optionalString,
        selectedSlotStart: optionalString,
        selectedSlotIndex: optionalNumber,
        serviceOfferingId: optionalString,
        bookingId: optionalString,
        clientName: optionalString,
        addonNames: optionalStringArray,
        addonsConfirmed: optionalBoolean,
        quotedPrice: optionalString,
        quotedDurationMinutes: optionalNumber,
        bookingStatus: {
          type: ['string', 'null'],
          enum: ['none', 'quoting', 'slots_offered', 'held', 'deposit_pending', 'confirmed'],
        },
      },
      additionalProperties: false,
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    next_action: {
      type: 'string',
      enum: [
        'ask_clarification',
        'confirm_style_price',
        'propose_slots',
        'create_hold',
        'send_deposit_link',
        'answer_faq',
        'escalate',
        'noop',
      ],
    },
    client_message: { type: 'string' },
    // Omit optional escalation_reason — Groq rejects tool calls when the model returns null
    // unless the field is explicitly nullable; safer to omit unused optionals entirely.
  },
  required: ['intent', 'extracted_slots', 'confidence', 'next_action', 'client_message'],
  additionalProperties: false,
} as const;

/**
 * Groq / OpenAI-compatible models often fill unused optional fields with `null`.
 * Strip those before Zod so omitted optionals stay omitted.
 */
export function stripNullsDeep(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => stripNullsDeep(item)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = stripNullsDeep(child);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return value;
}
