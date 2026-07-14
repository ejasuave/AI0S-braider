import type { Message } from '@prisma/client';
import type { ExtractedSlots, ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { messagingRepository } from '../messaging/repository.js';
import { profileService } from '../profile/service.js';
import {
  wasPriceAlreadyQuoted,
  extractStyleFromMessages,
  parsePreferredDateFromText,
} from './flow.js';

export type ConversationTurnContext = {
  conversationId: string;
  stylistId: string;
  clientId: string;
  channel: string;
  status: string;
  timezone: string;
  nowIso: string;
  messages: Array<{ sender: string; content: string; createdAt: string }>;
  mergedSlots: ExtractedSlots;
  stylistContext: {
    businessName: string;
    locationArea: string | null;
    offerings: Array<{
      id: string;
      styleName: string;
      sizeTier: string | null;
      lengthTier: string | null;
      basePrice: string;
      estimatedDurationMinutes: number;
      isCustomStyle: boolean;
    }>;
    cancellationPolicy: unknown;
    depositPolicy: unknown;
  };
  proposedSlots: Array<{ index: number; startTime: string; endTime: string }>;
  pendingBookingId: string | null;
  latestClientMessage: string;
  priceAlreadyQuoted: boolean;
  lastAiNextAction: ReceptionistTurnOutput['next_action'] | null;
};

const STALE_SLOT_FIELDS: Array<keyof ExtractedSlots> = [
  'serviceOfferingId',
  'bookingId',
  'selectedSlotStart',
  'selectedSlotIndex',
];

/** Ch.13.1 — cap history passed to the model; older messages are truncated. */
export function selectMessagesForPrompt<T extends { createdAt: string }>(
  messages: T[],
  maxMessages?: number,
): T[] {
  const limit = maxMessages ?? getEnv().AI_RECEPTIONIST_MAX_HISTORY_MESSAGES;
  if (messages.length <= limit) {
    return messages;
  }
  return messages.slice(-limit);
}

/** Ch.13.3 — merge slots across turns; style changes invalidate stale pricing/hold data. */
export function mergeSlotsFromMessages(messages: Message[]): ExtractedSlots {
  const merged: ExtractedSlots = {};
  let previousStyleName: string | undefined;

  for (const message of messages) {
    if (message.sender !== 'ai' || !message.structuredOutput) continue;
    const parsed = receptionistTurnOutputSchema.safeParse(message.structuredOutput);
    if (!parsed.success) continue;

    const newSlots = parsed.data.extracted_slots;
    if (
      newSlots.styleName &&
      previousStyleName &&
      newSlots.styleName.trim().toLowerCase() !== previousStyleName.trim().toLowerCase()
    ) {
      for (const field of STALE_SLOT_FIELDS) {
        delete merged[field];
      }
    }

    Object.assign(merged, newSlots);
    if (merged.styleName) {
      previousStyleName = merged.styleName;
    }
  }

  return merged;
}

function extractProposedSlots(messages: Message[]): ConversationTurnContext['proposedSlots'] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender !== 'ai' || !message.structuredOutput) continue;
    const meta = message.structuredOutput as Record<string, unknown>;
    const slots = meta.proposed_slots;
    if (Array.isArray(slots)) {
      return slots
        .map((slot, slotIndex) => {
          if (!slot || typeof slot !== 'object') return null;
          const startTime = (slot as { startTime?: string }).startTime;
          const endTime = (slot as { endTime?: string }).endTime;
          if (!startTime || !endTime) return null;
          return { index: slotIndex + 1, startTime, endTime };
        })
        .filter(
          (slot): slot is { index: number; startTime: string; endTime: string } => slot !== null,
        );
    }
  }
  return [];
}

function getLatestClientMessage(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender === 'client') {
      return message.content;
    }
  }
  return '';
}

function getLastAiNextAction(messages: Message[]): ReceptionistTurnOutput['next_action'] | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender !== 'ai' || !message.structuredOutput) continue;
    const parsed = receptionistTurnOutputSchema.safeParse(message.structuredOutput);
    if (parsed.success) {
      return parsed.data.next_action;
    }
  }
  return null;
}

export async function buildConversationTurnContext(
  conversationId: string,
): Promise<ConversationTurnContext | null> {
  const env = getEnv();
  const conversation = await messagingRepository.getConversationById(conversationId);
  if (!conversation) return null;

  const messages = conversation.messages ?? [];
  const bookingPage = await profileService.getPublicBookingPage(conversation.stylistId);
  const offerings = await profileService.listServiceOfferings(conversation.stylistId);
  const profile = await profileService.getSchedulingSettings(conversation.stylistId);
  const fullProfile = await profileService.getProfileByStylistId(conversation.stylistId);

  const mergedSlots = mergeSlotsFromMessages(messages);
  const fullMessageHistory = messages.map((message) => ({
    sender: message.sender,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }));

  if (!mergedSlots.styleName) {
    const styleName = extractStyleFromMessages(fullMessageHistory);
    if (styleName) {
      mergedSlots.styleName = styleName;
    }
  }

  if (!mergedSlots.preferredDate) {
    const now = new Date();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]!;
      if (message.sender !== 'client') continue;
      const preferredDate = parsePreferredDateFromText(message.content, now);
      if (preferredDate) {
        mergedSlots.preferredDate = preferredDate;
        break;
      }
    }
  }

  const pendingBookingId = mergedSlots.bookingId ?? null;
  const latestClientMessage = getLatestClientMessage(messages);
  const priceAlreadyQuoted = wasPriceAlreadyQuoted(messages, mergedSlots);
  const lastAiNextAction = getLastAiNextAction(messages);

  return {
    conversationId,
    stylistId: conversation.stylistId,
    clientId: conversation.clientId,
    channel: conversation.channel,
    status: conversation.status,
    timezone: env.PLATFORM_TIMEZONE,
    nowIso: new Date().toISOString(),
    messages: selectMessagesForPrompt(
      messages.map((message) => ({
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    ),
    mergedSlots,
    stylistContext: {
      businessName: bookingPage.businessName,
      locationArea: bookingPage.locationArea,
      offerings: offerings.map((offering) => ({
        id: offering.id,
        styleName: offering.styleName,
        sizeTier: offering.sizeTier,
        lengthTier: offering.lengthTier,
        basePrice: offering.basePrice,
        estimatedDurationMinutes: offering.estimatedDurationMinutes,
        isCustomStyle: offering.isCustomStyle,
      })),
      cancellationPolicy: fullProfile.cancellationPolicy,
      depositPolicy: profile.depositPolicy,
    },
    proposedSlots: extractProposedSlots(messages),
    pendingBookingId,
    latestClientMessage,
    priceAlreadyQuoted,
    lastAiNextAction,
  };
}

export function buildCorrectionPrompt(errorSummary: string): string {
  return `Your previous response was invalid: ${errorSummary}. Return a valid receptionist_turn tool call that follows the schema exactly.`;
}

export function attachStructuredMetadata(
  output: ReceptionistTurnOutput,
  metadata?: Record<string, unknown>,
): ReceptionistTurnOutput & Record<string, unknown> {
  return {
    ...output,
    ...(metadata ?? {}),
  };
}
