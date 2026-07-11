import type { ExtractedSlots, ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import type { ConversationTurnContext } from './context.js';

const BOOKING_INTENT_PATTERN = /\b(book|booking|book me|schedule|appointment|reserve|slot|availab)/i;
const SLOT_PICK_PATTERN = /(?:^|\s)([1-3])(?:\s|$)|option\s*([1-3])|number\s*([1-3])/i;

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Resolve "saturday" / "next friday" to YYYY-MM-DD (UTC date key). */
export function parsePreferredDateFromText(text: string, now: Date): string | undefined {
  const lower = text.toLowerCase();

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const name = WEEKDAY_NAMES[candidate.getUTCDay()]!;
    if (lower.includes(name)) {
      return candidate.toISOString().slice(0, 10);
    }
  }

  if (/\btoday\b/i.test(lower)) {
    return now.toISOString().slice(0, 10);
  }
  if (/\btomorrow\b/i.test(lower)) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  return undefined;
}

function parseSelectedSlotIndex(text: string): number | undefined {
  const match = text.match(SLOT_PICK_PATTERN);
  if (!match) return undefined;
  const value = match[1] ?? match[2] ?? match[3];
  const index = Number(value);
  return index >= 1 && index <= 3 ? index : undefined;
}

function mergedSlots(
  context: ConversationTurnContext,
  output: ReceptionistTurnOutput,
): ExtractedSlots {
  return { ...context.mergedSlots, ...output.extracted_slots };
}

/**
 * Correct model/mock outputs that loop on pricing instead of advancing the booking flow.
 */
export function advanceBookingFlow(
  output: ReceptionistTurnOutput,
  context: ConversationTurnContext,
): ReceptionistTurnOutput {
  const latest = context.latestClientMessage;
  const slots = mergedSlots(context, output);
  const preferredDate =
    output.extracted_slots.preferredDate ??
    slots.preferredDate ??
    parsePreferredDateFromText(latest, new Date(context.nowIso));

  const slotIndex = parseSelectedSlotIndex(latest);
  if (slotIndex && context.proposedSlots.length > 0) {
    return {
      ...output,
      intent: 'slot_selection',
      next_action: 'create_hold',
      confidence: Math.max(output.confidence, 0.9),
      extracted_slots: {
        ...output.extracted_slots,
        selectedSlotIndex: slotIndex,
        serviceOfferingId: slots.serviceOfferingId,
        styleName: slots.styleName,
      },
      client_message:
        output.client_message.trim() || `Great — I'll reserve option ${slotIndex} for you.`,
    };
  }

  const wantsBooking = BOOKING_INTENT_PATTERN.test(latest);
  const hasStyle = Boolean(slots.styleName);
  const canProposeSlots = hasStyle && (context.priceAlreadyQuoted || slots.serviceOfferingId);

  if (output.next_action === 'confirm_style_price' && context.priceAlreadyQuoted) {
    return {
      ...output,
      intent: 'new_booking',
      next_action: 'propose_slots',
      extracted_slots: {
        ...output.extracted_slots,
        styleName: slots.styleName,
        sizeTier: slots.sizeTier,
        lengthTier: slots.lengthTier,
        serviceOfferingId: slots.serviceOfferingId,
        ...(preferredDate ? { preferredDate } : {}),
      },
      client_message: preferredDate
        ? `Checking availability around ${preferredDate} — one moment.`
        : 'Let me find the next available appointment times for you.',
    };
  }

  if (wantsBooking && canProposeSlots && context.proposedSlots.length === 0) {
    if (output.next_action === 'confirm_style_price' || output.next_action === 'ask_clarification') {
      return {
        ...output,
        intent: 'new_booking',
        next_action: 'propose_slots',
        extracted_slots: {
          ...output.extracted_slots,
          styleName: slots.styleName,
          sizeTier: slots.sizeTier,
          lengthTier: slots.lengthTier,
          serviceOfferingId: slots.serviceOfferingId,
          ...(preferredDate ? { preferredDate } : {}),
        },
        client_message: preferredDate
          ? `I'll check what's open on ${preferredDate}.`
          : 'Here are the next available times — reply with the number you want.',
      };
    }
  }

  if (preferredDate && hasStyle && canProposeSlots && output.next_action === 'confirm_style_price') {
    return {
      ...output,
      intent: 'new_booking',
      next_action: 'propose_slots',
      extracted_slots: {
        ...output.extracted_slots,
        preferredDate,
        styleName: slots.styleName,
        serviceOfferingId: slots.serviceOfferingId,
      },
      client_message: `Checking availability for ${preferredDate}.`,
    };
  }

  if (wantsBooking && hasStyle && !canProposeSlots && output.next_action !== 'confirm_style_price') {
    return {
      ...output,
      intent: 'new_booking',
      next_action: 'confirm_style_price',
      extracted_slots: {
        ...output.extracted_slots,
        styleName: slots.styleName,
      },
      client_message: `I can help book ${slots.styleName}. Let me confirm pricing first.`,
    };
  }

  return output;
}

export function wasPriceAlreadyQuoted(
  messages: Array<{ sender: string; structuredOutput: unknown | null; content: string }>,
  mergedSlots: ExtractedSlots,
): boolean {
  if (mergedSlots.serviceOfferingId) {
    return true;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender !== 'ai') continue;
    if (/£\d/.test(message.content)) {
      return true;
    }
    if (!message.structuredOutput) continue;
    const parsed = receptionistTurnOutputSchema.safeParse(message.structuredOutput);
    if (!parsed.success) continue;
    if (
      parsed.data.next_action === 'confirm_style_price' ||
      parsed.data.next_action === 'propose_slots' ||
      parsed.data.next_action === 'create_hold'
    ) {
      return true;
    }
  }

  return false;
}
