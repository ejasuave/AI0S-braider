import type { Message } from '@prisma/client';
import type { ExtractedSlots, ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { clientPreferencesService } from '../client-preferences/service.js';
import { messagingRepository } from '../messaging/repository.js';
import { profileService } from '../profile/service.js';
import {
  wasPriceAlreadyQuoted,
  extractStyleFromMessages,
  parsePreferredDateFromText,
} from './flow.js';

export type WorkingHoursDay = {
  enabled: boolean;
  start: string;
  end: string;
};

export type SessionMemory = {
  clientName: string | null;
  stylistBusinessName: string;
  styleName: string | null;
  sizeTier: string | null;
  lengthTier: string | null;
  quotedPrice: string | null;
  quotedDurationMinutes: number | null;
  addonNames: string[];
  preferredDate: string | null;
  selectedSlotIndex: number | null;
  selectedSlotStart: string | null;
  bookingId: string | null;
  bookingStatus: string;
  priceAlreadyQuoted: boolean;
  lastAiNextAction: ReceptionistTurnOutput['next_action'] | null;
  clarificationStreak: number;
  idleGapMinutes: number | null;
  channel: string;
};

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
  sessionMemory: SessionMemory;
  stylistContext: {
    businessName: string;
    locationArea: string | null;
    workingHoursSummary: string;
    offerings: Array<{
      id: string;
      styleName: string;
      sizeTier: string | null;
      lengthTier: string | null;
      basePrice: string;
      estimatedDurationMinutes: number;
      isCustomStyle: boolean;
      requirements: string[];
      addons: Array<{ name: string; price: string }>;
    }>;
    cancellationPolicy: unknown;
    depositPolicy: unknown;
    remainingBalanceMethod: string | null;
    policyNotes: {
      cancellationWindowHours: number | null;
      cancellationPolicyText: string | null;
      reschedulingPolicyText: string | null;
      depositPolicyText: string | null;
      childrenPolicyText: string | null;
      guestPolicyText: string | null;
      refundPolicyText: string | null;
      lateArrivalPolicyText: string | null;
      noShowPolicyText: string | null;
    };
  };
  proposedSlots: Array<{ index: number; startTime: string; endTime: string }>;
  pendingBookingId: string | null;
  latestClientMessage: string;
  priceAlreadyQuoted: boolean;
  lastAiNextAction: ReceptionistTurnOutput['next_action'] | null;
  clarificationStreak: number;
};

const STALE_SLOT_FIELDS: Array<keyof ExtractedSlots> = [
  'serviceOfferingId',
  'bookingId',
  'selectedSlotStart',
  'selectedSlotIndex',
  'quotedPrice',
  'quotedDurationMinutes',
  'addonNames',
  'bookingStatus',
];

const WEEKDAY_LABELS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Idle gap above this is noted in session memory (recovery after refresh / long pause). */
export const IDLE_GAP_NOTE_MINUTES = 30;

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

function styleChanged(previous: string | undefined, next: string | undefined): boolean {
  if (!previous || !next) return false;
  return previous.trim().toLowerCase() !== next.trim().toLowerCase();
}

function sizeOrLengthChanged(merged: ExtractedSlots, incoming: ExtractedSlots): boolean {
  if (
    incoming.sizeTier &&
    merged.sizeTier &&
    incoming.sizeTier.trim().toLowerCase() !== merged.sizeTier.trim().toLowerCase()
  ) {
    return true;
  }
  if (
    incoming.lengthTier &&
    merged.lengthTier &&
    incoming.lengthTier.trim().toLowerCase() !== merged.lengthTier.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

/** Ch.13.3 — merge slots across turns; style/tier changes invalidate stale pricing/hold data. */
export function mergeSlotsFromMessages(messages: Message[]): ExtractedSlots {
  const merged: ExtractedSlots = {};
  let previousStyleName: string | undefined;

  for (const message of messages) {
    if (message.sender !== 'ai' || !message.structuredOutput) continue;
    const parsed = receptionistTurnOutputSchema.safeParse(message.structuredOutput);
    if (!parsed.success) continue;

    const newSlots = parsed.data.extracted_slots;
    const shouldClearStale =
      styleChanged(previousStyleName, newSlots.styleName) || sizeOrLengthChanged(merged, newSlots);

    if (shouldClearStale) {
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

export function formatWorkingHoursSummary(
  hours: Record<string, WorkingHoursDay> | null | undefined,
): string {
  if (!hours) return 'not specified';
  const lines: string[] = [];
  for (const day of WEEKDAY_LABELS) {
    const entry = hours[day];
    if (!entry) continue;
    if (!entry.enabled) {
      lines.push(`${day}: closed`);
      continue;
    }
    lines.push(`${day}: ${entry.start}–${entry.end}`);
  }
  return lines.length > 0 ? lines.join('; ') : 'not specified';
}

/**
 * Consecutive AI ask_clarification turns at the end of the thread with no new
 * style/date/slot progress in those turns.
 */
export function countClarificationStreak(messages: Message[]): number {
  let streak = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender !== 'ai' || !message.structuredOutput) {
      if (message.sender === 'client') continue;
      break;
    }
    const parsed = receptionistTurnOutputSchema.safeParse(message.structuredOutput);
    if (!parsed.success || parsed.data.next_action !== 'ask_clarification') {
      break;
    }
    const slots = parsed.data.extracted_slots;
    const progressed = Boolean(
      slots.styleName ||
      slots.preferredDate ||
      slots.selectedSlotIndex ||
      slots.selectedSlotStart ||
      slots.serviceOfferingId ||
      slots.bookingId,
    );
    if (progressed) break;
    streak += 1;
  }
  return streak;
}

export function computeIdleGapMinutes(
  messages: Array<{ createdAt: string | Date }>,
  now: Date = new Date(),
): number | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1]!;
  const lastAt = last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt);
  const gapMs = now.getTime() - lastAt.getTime();
  if (gapMs < IDLE_GAP_NOTE_MINUTES * 60 * 1000) return null;
  return Math.floor(gapMs / (60 * 1000));
}

export function buildSessionMemory(input: {
  mergedSlots: ExtractedSlots;
  stylistBusinessName: string;
  clientDisplayName: string | null;
  priceAlreadyQuoted: boolean;
  lastAiNextAction: ReceptionistTurnOutput['next_action'] | null;
  clarificationStreak: number;
  idleGapMinutes: number | null;
  channel: string;
}): SessionMemory {
  const { mergedSlots } = input;
  return {
    clientName: mergedSlots.clientName ?? input.clientDisplayName,
    stylistBusinessName: input.stylistBusinessName,
    styleName: mergedSlots.styleName ?? null,
    sizeTier: mergedSlots.sizeTier ?? null,
    lengthTier: mergedSlots.lengthTier ?? null,
    quotedPrice: mergedSlots.quotedPrice ?? null,
    quotedDurationMinutes: mergedSlots.quotedDurationMinutes ?? null,
    addonNames: mergedSlots.addonNames ?? [],
    preferredDate: mergedSlots.preferredDate ?? null,
    selectedSlotIndex: mergedSlots.selectedSlotIndex ?? null,
    selectedSlotStart: mergedSlots.selectedSlotStart ?? null,
    bookingId: mergedSlots.bookingId ?? null,
    bookingStatus: mergedSlots.bookingStatus ?? 'none',
    priceAlreadyQuoted: input.priceAlreadyQuoted,
    lastAiNextAction: input.lastAiNextAction,
    clarificationStreak: input.clarificationStreak,
    idleGapMinutes: input.idleGapMinutes,
    channel: input.channel,
  };
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
  const profile = await profileService.getSchedulingSettings(conversation.stylistId);
  const fullProfile = await profileService.getProfileByStylistId(conversation.stylistId);
  const availability = await profileService.getAvailabilityContext(conversation.stylistId);
  let clientDisplayName: string | null = null;
  try {
    const clientProfile = await clientPreferencesService.getProfile(conversation.clientId);
    clientDisplayName = clientProfile.displayName;
  } catch {
    clientDisplayName = null;
  }

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

  if (!mergedSlots.clientName && clientDisplayName) {
    mergedSlots.clientName = clientDisplayName;
  }

  const pendingBookingId = mergedSlots.bookingId ?? null;
  const latestClientMessage = getLatestClientMessage(messages);
  const priceAlreadyQuoted = wasPriceAlreadyQuoted(messages, mergedSlots);
  const lastAiNextAction = getLastAiNextAction(messages);
  const clarificationStreak = countClarificationStreak(messages);
  const now = new Date();
  const idleGapMinutes = computeIdleGapMinutes(messages, now);

  const sessionMemory = buildSessionMemory({
    mergedSlots,
    stylistBusinessName: bookingPage.businessName,
    clientDisplayName,
    priceAlreadyQuoted,
    lastAiNextAction,
    clarificationStreak,
    idleGapMinutes,
    channel: conversation.channel,
  });

  return {
    conversationId,
    stylistId: conversation.stylistId,
    clientId: conversation.clientId,
    channel: conversation.channel,
    status: conversation.status,
    timezone: env.PLATFORM_TIMEZONE,
    nowIso: now.toISOString(),
    messages: selectMessagesForPrompt(
      messages.map((message) => ({
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    ),
    mergedSlots,
    sessionMemory,
    stylistContext: {
      businessName: bookingPage.businessName,
      locationArea: bookingPage.locationArea,
      workingHoursSummary: formatWorkingHoursSummary(availability.workingHours),
      offerings: bookingPage.offerings.map((offering) => ({
        id: offering.id,
        styleName: offering.styleName,
        sizeTier: offering.sizeTier,
        lengthTier: offering.lengthTier,
        basePrice: offering.basePrice,
        estimatedDurationMinutes: offering.estimatedDurationMinutes,
        isCustomStyle: false,
        requirements: offering.requirements.map((item) =>
          typeof item === 'string' ? item : item.text,
        ),
        addons: offering.addons.map((addon) => ({ name: addon.name, price: addon.price })),
      })),
      cancellationPolicy: fullProfile.cancellationPolicy,
      depositPolicy: profile.depositPolicy,
      remainingBalanceMethod: bookingPage.remainingBalanceMethod,
      policyNotes: {
        cancellationWindowHours: bookingPage.policy?.cancellationWindowHours ?? null,
        cancellationPolicyText: bookingPage.policy?.cancellationPolicyText ?? null,
        reschedulingPolicyText: bookingPage.policy?.reschedulingPolicyText ?? null,
        depositPolicyText: bookingPage.policy?.depositPolicyText ?? null,
        childrenPolicyText: bookingPage.policy?.childrenPolicyText ?? null,
        guestPolicyText: bookingPage.policy?.guestPolicyText ?? null,
        refundPolicyText: bookingPage.policy?.refundPolicyText ?? null,
        lateArrivalPolicyText: bookingPage.policy?.lateArrivalPolicyText ?? null,
        noShowPolicyText: bookingPage.policy?.noShowPolicyText ?? null,
      },
    },
    proposedSlots: extractProposedSlots(messages),
    pendingBookingId,
    latestClientMessage,
    priceAlreadyQuoted,
    lastAiNextAction,
    clarificationStreak,
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
