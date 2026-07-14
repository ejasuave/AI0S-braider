import { ESCALATION_REASONS } from '@project-braids/shared-types/api';

const REASON_LABELS: Record<string, string> = {
  [ESCALATION_REASONS.confidenceBelowThreshold]: 'Low AI confidence',
  [ESCALATION_REASONS.structuredOutputValidationFailed]: 'AI validation failed',
  [ESCALATION_REASONS.ambiguousSlotSelection]: 'Ambiguous slot choice',
  [ESCALATION_REASONS.customStyleUnresolvable]: 'Unrecognized style',
  [ESCALATION_REASONS.pricingLookupLowConfidence]: 'Pricing unclear',
  [ESCALATION_REASONS.intentRequiresHuman]: 'Needs human review',
  [ESCALATION_REASONS.smsOptOut]: 'Client opted out of AI',
  [ESCALATION_REASONS.killSwitch]: 'AI paused by stylist',
  [ESCALATION_REASONS.promptInjection]: 'Suspicious message',
  [ESCALATION_REASONS.dispatchFailed]: 'Booking action failed',
};

export function formatEscalationReason(reason: string): string {
  const base = reason.split(':')[0] ?? reason;
  if (REASON_LABELS[base]) {
    return REASON_LABELS[base];
  }
  return reason.replaceAll('_', ' ');
}

export function isStyleRecognitionEscalation(reason: string): boolean {
  const base = reason.split(':')[0] ?? reason;
  return base === ESCALATION_REASONS.customStyleUnresolvable || base === 'unrecognized_style_image';
}
