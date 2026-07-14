import type { ExtractedSlots, ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import type { ConversationTurnContext } from './context.js';

const PRICE_INTENT_PATTERN = /\b(price|cost|how much|£|pound)/i;
const AVAILABILITY_QUESTION_PATTERN =
  /\b(what days|which days|when are you|availability|available times|open slots|times available)\b/i;
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

const STYLE_PATTERNS: Array<{ pattern: RegExp; styleName: string }> = [
  { pattern: /\bbox braids?\b/i, styleName: 'Box braids' },
  { pattern: /\bknotless braids?\b/i, styleName: 'Knotless braids' },
  { pattern: /\bcornrows?\b/i, styleName: 'Cornrows' },
  { pattern: /\bfrench curl\b/i, styleName: 'French curl' },
  { pattern: /\bpassion twists?\b/i, styleName: 'Passion twists' },
  { pattern: /\bbraids?\b/i, styleName: 'Box braids' },
];

export type BookingPhase =
  | 'general'
  | 'need_style'
  | 'quote_price'
  | 'awaiting_day_or_book'
  | 'propose_slots'
  | 'prompt_slot_pick'
  | 'confirm_slot';

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

export function extractStyleFromText(text: string): string | undefined {
  for (const { pattern, styleName } of STYLE_PATTERNS) {
    if (pattern.test(text)) return styleName;
  }
  return undefined;
}

export function extractStyleFromMessages(
  messages: ConversationTurnContext['messages'],
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.sender !== 'client') continue;
    const style = extractStyleFromText(message.content);
    if (style) return style;
  }

  const combined = messages.map((message) => message.content).join(' ');
  return extractStyleFromText(combined);
}

function parsePreferredDateFromHistory(context: ConversationTurnContext): string | undefined {
  const now = new Date(context.nowIso);
  const fromLatest = parsePreferredDateFromText(context.latestClientMessage, now);
  if (fromLatest) return fromLatest;
  if (context.mergedSlots.preferredDate) return context.mergedSlots.preferredDate;

  for (let index = context.messages.length - 1; index >= 0; index -= 1) {
    const message = context.messages[index]!;
    if (message.sender !== 'client') continue;
    const date = parsePreferredDateFromText(message.content, now);
    if (date) return date;
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
  const styleName =
    output.extracted_slots.styleName ??
    context.mergedSlots.styleName ??
    extractStyleFromMessages(context.messages);

  return {
    ...context.mergedSlots,
    ...output.extracted_slots,
    ...(styleName ? { styleName } : {}),
  };
}

function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  const weekday = WEEKDAY_NAMES[date.getUTCDay()] ?? 'that day';
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const day = date.getUTCDate();
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${capitalized} ${day} ${month}`;
}

function clientWantsToBook(latest: string): boolean {
  return /\b(book|booking|book me|schedule|appointment|reserve|slot|availab)\b/i.test(latest);
}

function clientAffirms(latest: string): boolean {
  return /\b(yes|yeah|yep|sure|okay|ok|please|go ahead|sounds good|that works|do it)\b/i.test(
    latest,
  );
}

export function inferBookingPhase(
  context: ConversationTurnContext,
  slots: ExtractedSlots,
): BookingPhase {
  const latest = context.latestClientMessage;
  const styleName = slots.styleName;
  const preferredDate = parsePreferredDateFromHistory(context);
  const slotIndex = parseSelectedSlotIndex(latest);

  if (slotIndex && context.proposedSlots.length > 0) {
    return 'confirm_slot';
  }

  if (context.proposedSlots.length > 0) {
    if ((clientWantsToBook(latest) || clientAffirms(latest)) && !slotIndex) {
      return 'prompt_slot_pick';
    }
    return 'propose_slots';
  }

  if (styleName && clientWantsToBook(latest)) {
    return 'propose_slots';
  }

  if (styleName && context.priceAlreadyQuoted) {
    if (clientWantsToBook(latest) || preferredDate || AVAILABILITY_QUESTION_PATTERN.test(latest)) {
      return 'propose_slots';
    }
    if (clientAffirms(latest) && context.lastAiNextAction === 'confirm_style_price') {
      return 'propose_slots';
    }
    return 'general';
  }

  if (
    styleName &&
    (PRICE_INTENT_PATTERN.test(latest) || clientWantsToBook(latest) || preferredDate)
  ) {
    return 'quote_price';
  }

  if (styleName) {
    return 'quote_price';
  }

  if (clientWantsToBook(latest) || PRICE_INTENT_PATTERN.test(latest)) {
    return 'need_style';
  }

  return 'general';
}

/** Human SMS copy that directly answers the client's latest message. */
export function composeHumanBookingReply(
  phase: BookingPhase,
  context: ConversationTurnContext,
  slots: ExtractedSlots,
): string {
  const latest = context.latestClientMessage;
  const styleName = slots.styleName;
  const preferredDate = parsePreferredDateFromHistory(context);
  const slotIndex = parseSelectedSlotIndex(latest);

  switch (phase) {
    case 'need_style':
      if (PRICE_INTENT_PATTERN.test(latest)) {
        return 'Happy to help with pricing — which braiding style are you thinking of?';
      }
      return "I'd love to get you booked — what style are you after?";

    case 'quote_price':
      if (preferredDate && styleName) {
        return `${styleName} on ${formatDayLabel(preferredDate)} — here's the pricing:`;
      }
      if (PRICE_INTENT_PATTERN.test(latest) && styleName) {
        return `Sure — here's what ${styleName} costs:`;
      }
      if (styleName) {
        return `Lovely — ${styleName}. Here's the pricing:`;
      }
      return 'Let me check pricing for you.';

    case 'awaiting_day_or_book':
      if (preferredDate) {
        return `I can check ${formatDayLabel(preferredDate)} — want me to send available times?`;
      }
      return 'What day works for you? I can send times to pick from.';

    case 'propose_slots':
      if (AVAILABILITY_QUESTION_PATTERN.test(latest)) {
        return styleName
          ? `Good question — let me check what's open for ${styleName}.`
          : 'Let me see which times are available.';
      }
      if (slotIndex) {
        return `Perfect — I'll reserve option ${slotIndex} for you.`;
      }
      if (clientWantsToBook(latest) || clientAffirms(latest)) {
        return styleName
          ? `Of course — let me find open times for ${styleName}.`
          : 'On it — pulling up available times now.';
      }
      if (preferredDate) {
        return `Checking what's open on ${formatDayLabel(preferredDate)}.`;
      }
      return 'Here are the next available times:';

    case 'prompt_slot_pick':
      return "Just reply 1, 2, or 3 from the times above and I'll get you booked in.";

    case 'confirm_slot':
      return `Great — I'll book option ${slotIndex ?? 1} for you.`;

    default:
      return '';
  }
}

function phaseToNextAction(phase: BookingPhase): ReceptionistTurnOutput['next_action'] {
  switch (phase) {
    case 'need_style':
      return 'ask_clarification';
    case 'quote_price':
      return 'confirm_style_price';
    case 'awaiting_day_or_book':
      return 'ask_clarification';
    case 'prompt_slot_pick':
      return 'ask_clarification';
    case 'propose_slots':
      return 'propose_slots';
    case 'confirm_slot':
      return 'create_hold';
    default:
      return 'answer_faq';
  }
}

const NON_BOOKING_INTENTS = new Set<ReceptionistTurnOutput['intent']>([
  'dispute',
  'complaint',
  'out_of_scope',
  'prompt_injection',
  'reschedule',
]);

/**
 * Deterministic booking flow — overrides model output so the assistant advances
 * the conversation and replies to what the client actually said.
 */
export function advanceBookingFlow(
  output: ReceptionistTurnOutput,
  context: ConversationTurnContext,
): ReceptionistTurnOutput {
  if (output.next_action === 'escalate' || NON_BOOKING_INTENTS.has(output.intent)) {
    return output;
  }

  const slots = mergedSlots(context, output);
  const preferredDate = parsePreferredDateFromHistory(context);
  const phase = inferBookingPhase(context, slots);
  const slotIndex = parseSelectedSlotIndex(context.latestClientMessage);

  if (phase === 'general') {
    return output;
  }

  const nextAction = phaseToNextAction(phase);
  const humanReply = composeHumanBookingReply(phase, context, slots);

  const extractedSlots: ExtractedSlots = {
    ...output.extracted_slots,
    ...slots,
    ...(preferredDate ? { preferredDate } : {}),
    ...(slotIndex ? { selectedSlotIndex: slotIndex } : {}),
  };

  return {
    ...output,
    intent: phase === 'confirm_slot' ? 'slot_selection' : 'new_booking',
    next_action: nextAction,
    confidence: Math.max(output.confidence, 0.9),
    extracted_slots: extractedSlots,
    client_message: humanReply || output.client_message,
  };
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
