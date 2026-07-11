import { describe, expect, it } from 'vitest';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';

describe('receptionistTurnOutputSchema', () => {
  it('accepts a valid structured turn', () => {
    const parsed = receptionistTurnOutputSchema.safeParse({
      intent: 'new_booking',
      extracted_slots: { styleName: 'Knotless braids', preferredDate: '2026-07-15' },
      confidence: 0.9,
      next_action: 'ask_clarification',
      client_message: 'Lovely — what size are you thinking?',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed output with invalid confidence', () => {
    const parsed = receptionistTurnOutputSchema.safeParse({
      intent: 'new_booking',
      confidence: 2,
      next_action: 'ask_clarification',
      client_message: 'Hello',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid next_action enum values', () => {
    const parsed = receptionistTurnOutputSchema.safeParse({
      intent: 'new_booking',
      confidence: 0.9,
      next_action: 'book_now',
      client_message: 'Hello',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing client_message', () => {
    const parsed = receptionistTurnOutputSchema.safeParse({
      intent: 'new_booking',
      confidence: 0.9,
      next_action: 'ask_clarification',
      client_message: '',
    });
    expect(parsed.success).toBe(false);
  });
});
