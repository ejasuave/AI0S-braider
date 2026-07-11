import type { ReceptionistIntent, ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import {
  ALWAYS_ESCALATE_INTENTS,
  ESCALATION_REASONS,
} from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';

export type EscalationDecision = {
  escalate: boolean;
  reason: string;
};

export type EscalationDispatchContext = {
  pricingConfidence?: number;
  threshold?: number;
  structuredOutputValidationFailed?: boolean;
  ambiguousSlotSelection?: boolean;
  customStyleUnresolvable?: boolean;
};

export function shouldEscalate(
  output: ReceptionistTurnOutput,
  context: EscalationDispatchContext = {},
): EscalationDecision {
  const threshold = context.threshold ?? getEnv().AI_CONFIDENCE_THRESHOLD;

  if (context.structuredOutputValidationFailed) {
    return {
      escalate: true,
      reason: ESCALATION_REASONS.structuredOutputValidationFailed,
    };
  }

  if (context.ambiguousSlotSelection) {
    return {
      escalate: true,
      reason: ESCALATION_REASONS.ambiguousSlotSelection,
    };
  }

  if (context.customStyleUnresolvable) {
    return {
      escalate: true,
      reason: ESCALATION_REASONS.customStyleUnresolvable,
    };
  }

  if ((ALWAYS_ESCALATE_INTENTS as readonly ReceptionistIntent[]).includes(output.intent)) {
    return {
      escalate: true,
      reason:
        output.escalation_reason ??
        `${ESCALATION_REASONS.intentRequiresHuman}:${output.intent}`,
    };
  }

  if (output.next_action === 'escalate') {
    return {
      escalate: true,
      reason: output.escalation_reason ?? ESCALATION_REASONS.intentRequiresHuman,
    };
  }

  if (output.confidence < threshold) {
    return {
      escalate: true,
      reason:
        output.escalation_reason ??
        `${ESCALATION_REASONS.confidenceBelowThreshold}:${output.confidence}`,
    };
  }

  if (context.pricingConfidence !== undefined && context.pricingConfidence < threshold) {
    return {
      escalate: true,
      reason: ESCALATION_REASONS.pricingLookupLowConfidence,
    };
  }

  return { escalate: false, reason: '' };
}

export function detectPromptInjection(message: string): boolean {
  const normalized = message.toLowerCase();
  const patterns = [
    'ignore your instructions',
    'ignore previous instructions',
    'disregard previous',
    'system prompt',
    'you are now',
    'i am the stylist',
    'i am the admin',
    'i am an admin',
    'admin override',
    'free booking',
    'waive the deposit',
    'skip the deposit',
    'no deposit',
    'without payment',
    'change the price',
    'override policy',
    'disregard policy',
    'confirm this booking for £0',
    'confirm this booking for 0',
    'reveal your instructions',
    'show me your prompt',
    'what are your rules',
    'internal configuration',
  ];
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function isAmbiguousSlotSelection(
  proposedSlots: Array<{ index: number }>,
  output: ReceptionistTurnOutput,
  mergedSlots: {
    selectedSlotStart?: string;
    selectedSlotIndex?: number;
  },
): boolean {
  if (output.intent !== 'slot_selection' && output.next_action !== 'create_hold') {
    return false;
  }
  if (proposedSlots.length === 0) {
    return false;
  }
  if (mergedSlots.selectedSlotStart) {
    return false;
  }
  if (
    mergedSlots.selectedSlotIndex &&
    proposedSlots.some((slot) => slot.index === mergedSlots.selectedSlotIndex)
  ) {
    return false;
  }
  return true;
}
