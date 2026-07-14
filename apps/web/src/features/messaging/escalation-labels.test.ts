import { describe, expect, it } from 'vitest';
import { formatEscalationReason, isStyleRecognitionEscalation } from './escalation-labels';

describe('formatEscalationReason', () => {
  it('returns human label for known escalation codes', () => {
    expect(formatEscalationReason('structured_output_validation_failed')).toBe(
      'AI validation failed',
    );
    expect(formatEscalationReason('custom_style_unresolvable')).toBe('Unrecognized style');
  });

  it('strips suffix after colon for compound reasons', () => {
    expect(formatEscalationReason('intent_requires_human_review:pricing')).toBe(
      'Needs human review',
    );
  });
});

describe('isStyleRecognitionEscalation', () => {
  it('detects style-related escalation reasons', () => {
    expect(isStyleRecognitionEscalation('custom_style_unresolvable')).toBe(true);
    expect(isStyleRecognitionEscalation('unrecognized_style_image')).toBe(true);
    expect(isStyleRecognitionEscalation('sms_opt_out')).toBe(false);
  });
});
