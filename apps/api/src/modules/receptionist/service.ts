import {
  receptionistTurnOutputSchema,
  type ReceptionistTurnOutput,
  ESCALATION_REASONS,
} from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { getClaudeProvider } from '../../lib/claude/index.js';
import { createLogger } from '../../lib/logger.js';
import { messagingRepository } from '../messaging/repository.js';
import { messagingService } from '../messaging/service.js';
import { clientPreferencesService } from '../client-preferences/service.js';
import { profileService } from '../profile/service.js';
import { buildConversationTurnContext, buildCorrectionPrompt } from './context.js';
import { dispatchReceptionistTurn } from './dispatch.js';
import { detectPromptInjection, isAmbiguousSlotSelection, shouldEscalate } from './escalation.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { advanceBookingFlow } from './flow.js';

const log = createLogger().child({ module: 'receptionist' });

function isAiProviderTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('ai provider request failed') ||
    message.includes('credit balance') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('insufficient_quota') ||
    message.includes('unauthorized') ||
    /\b(401|402|429|503)\b/.test(message)
  );
}

export type ProcessTurnResult = {
  status: 'replied' | 'escalated' | 'skipped';
  reason?: string;
};

async function escalateWithModelContext(
  conversationId: string,
  reason: string,
  modelOutput?: ReceptionistTurnOutput,
): Promise<void> {
  await messagingService.escalateFromSystem(conversationId, reason, {
    modelConfidence: modelOutput?.confidence,
    modelNextAction: modelOutput?.next_action,
  });
}

async function completeTurnWithValidation(
  context: NonNullable<Awaited<ReturnType<typeof buildConversationTurnContext>>>,
  correction?: string,
): Promise<ReceptionistTurnOutput> {
  const claude = getClaudeProvider();
  const systemPrompt = correction
    ? `${buildSystemPrompt(context)}\n\n${buildCorrectionPrompt(correction)}`
    : buildSystemPrompt(context);

  const output = await claude.completeStructuredTurn({
    systemPrompt,
    messages: [{ role: 'user', content: buildUserPrompt(context) }],
  });

  const parsed = receptionistTurnOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

export class ReceptionistService {
  /** Ch.13.1 — orchestration entry point (alias for processInboundTurn). */
  async handleInboundMessage(conversationId: string): Promise<ProcessTurnResult> {
    return this.processInboundTurn(conversationId);
  }

  async processInboundTurn(conversationId: string): Promise<ProcessTurnResult> {
    const env = getEnv();
    const context = await buildConversationTurnContext(conversationId);
    if (!context) {
      return { status: 'skipped', reason: 'conversation_not_found' };
    }

    if (await messagingService.isEscalated(conversationId)) {
      return { status: 'skipped', reason: 'conversation_escalated' };
    }

    const clientPhone = await messagingRepository.getClientPhoneNumber(context.clientId);
    if (clientPhone && (await clientPreferencesService.isAiOptedOut(clientPhone))) {
      await escalateWithModelContext(conversationId, ESCALATION_REASONS.smsOptOut);
      return { status: 'escalated', reason: ESCALATION_REASONS.smsOptOut };
    }

    if (!env.AI_RECEPTIONIST_ENABLED) {
      await escalateWithModelContext(conversationId, ESCALATION_REASONS.killSwitch);
      return { status: 'escalated', reason: ESCALATION_REASONS.killSwitch };
    }

    const latestClient = await messagingRepository.getLatestClientMessage(conversationId);
    if (latestClient && detectPromptInjection(latestClient.content)) {
      await escalateWithModelContext(conversationId, ESCALATION_REASONS.promptInjection);
      return { status: 'escalated', reason: ESCALATION_REASONS.promptInjection };
    }

    let output: ReceptionistTurnOutput | undefined;
    try {
      output = await completeTurnWithValidation(context);
    } catch (firstError) {
      if (isAiProviderTransportError(firstError)) {
        log.error(
          { conversationId, err: firstError },
          'Receptionist AI provider unavailable; escalating',
        );
        await escalateWithModelContext(
          conversationId,
          ESCALATION_REASONS.aiProviderUnavailable,
        );
        return { status: 'escalated', reason: ESCALATION_REASONS.aiProviderUnavailable };
      }

      log.warn(
        { conversationId, err: firstError },
        'Receptionist structured output failed; retrying with correction',
      );
      try {
        output = await completeTurnWithValidation(
          context,
          firstError instanceof Error ? firstError.message : 'invalid structured output',
        );
      } catch (retryError) {
        if (isAiProviderTransportError(retryError)) {
          log.error(
            { conversationId, err: retryError },
            'Receptionist AI provider unavailable on retry; escalating',
          );
          await escalateWithModelContext(
            conversationId,
            ESCALATION_REASONS.aiProviderUnavailable,
          );
          return { status: 'escalated', reason: ESCALATION_REASONS.aiProviderUnavailable };
        }

        log.error(
          { conversationId, err: retryError },
          'Receptionist structured output failed after retry; escalating',
        );
        await escalateWithModelContext(
          conversationId,
          ESCALATION_REASONS.structuredOutputValidationFailed,
        );
        return {
          status: 'escalated',
          reason: ESCALATION_REASONS.structuredOutputValidationFailed,
        };
      }
    }

    const mergedSlots = { ...context.mergedSlots, ...output.extracted_slots };
    let pricingConfidence: number | undefined;
    let customStyleUnresolvable = false;

    if (output.extracted_slots.styleName && output.next_action !== 'escalate') {
      const pricing = await profileService.lookupPricing(context.stylistId, {
        styleName: output.extracted_slots.styleName,
        sizeTier: output.extracted_slots.sizeTier,
        lengthTier: output.extracted_slots.lengthTier,
      });
      pricingConfidence = pricing.confidence;
      if (!pricing.offering) {
        customStyleUnresolvable = true;
      } else if (
        pricing.offering.isCustomStyle &&
        pricing.confidence < env.AI_CONFIDENCE_THRESHOLD
      ) {
        customStyleUnresolvable = true;
      }
    }

    const ambiguousSlotSelection = isAmbiguousSlotSelection(
      context.proposedSlots,
      output,
      mergedSlots,
    );

    const escalation = shouldEscalate(output, {
      pricingConfidence,
      ambiguousSlotSelection,
      customStyleUnresolvable,
    });

    if (escalation.escalate) {
      await escalateWithModelContext(conversationId, escalation.reason, output);
      return { status: 'escalated', reason: escalation.reason };
    }

    output = advanceBookingFlow(output, context);

    try {
      await dispatchReceptionistTurn(context, output);
      return { status: 'replied' };
    } catch (error) {
      await escalateWithModelContext(
        conversationId,
        error instanceof Error ? error.message : ESCALATION_REASONS.dispatchFailed,
        output,
      );
      return { status: 'escalated', reason: ESCALATION_REASONS.dispatchFailed };
    }
  }
}

export const receptionistService = new ReceptionistService();
