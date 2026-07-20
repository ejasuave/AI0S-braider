/** Shared tool schema for Anthropic + OpenAI-compatible structured receptionist turns. */
export const RECEPTIONIST_TOOL_NAME = 'receptionist_turn';

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
        styleName: { type: 'string' },
        sizeTier: { type: 'string' },
        lengthTier: { type: 'string' },
        preferredDate: { type: 'string' },
        selectedSlotStart: { type: 'string' },
        selectedSlotIndex: { type: 'number' },
        serviceOfferingId: { type: 'string' },
        bookingId: { type: 'string' },
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
    // Omit optional escalation_reason — Groq rejects tool calls when the model returns null.
  },
  required: ['intent', 'extracted_slots', 'confidence', 'next_action', 'client_message'],
  additionalProperties: false,
} as const;
