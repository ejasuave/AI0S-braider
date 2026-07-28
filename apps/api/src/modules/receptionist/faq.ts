import { formatDurationLabel, type ReceptionistNextAction } from '@project-braids/shared-types/api';
import type { ConversationTurnContext } from './context.js';

/** Booking actions that require a resolved offering — style lookup may escalate. */
export const PRICING_REQUIRED_ACTIONS: ReadonlySet<ReceptionistNextAction> = new Set([
  'confirm_style_price',
  'propose_slots',
  'create_hold',
  'send_deposit_link',
]);

export const PRICE_INTENT_PATTERN = /\b(price|cost|how much|£|pound)\b/i;

export const AVAILABILITY_QUESTION_PATTERN =
  /\b(what days|which days|when are you free|availability|available times|open slots|times available|free slots)\b/i;

export const HOURS_FAQ_PATTERN =
  /\b(hours?|opening times?|what time (do you|are you) open|when (do you|are you) open|are you open|closed)\b/i;

export const SERVICES_LIST_PATTERN =
  /\b(what styles?( do you (do|offer|have))?|which styles?|what services?( do you (do|offer|have))?|which services?|what do you (do|offer)|price list|menu|offerings?|styles? (do )?you (do|offer))\b/i;

export const REQUIREMENTS_FAQ_PATTERN = /\b(requirement|requirements|what (do )?i need|bring|prep)\b/i;

/** Broad FAQ topics — mid-booking answers must not restart the booking FSM. */
export const FAQ_TOPIC_PATTERN =
  /\b(where|located|location|address|park|parking|hours?|open|closed|deposit|cancel|reschedul|policy|policies|requirement|bank transfer|card|cash|pay|payment|balance|review|direction|how long|take|duration|addon|add-on|recommend|face shape|maintenance|styles?|services?|offer|offering|menu|price list|what do you (do|offer))\b/i;

export function shouldRunPricingLookup(nextAction: ReceptionistNextAction): boolean {
  return PRICING_REQUIRED_ACTIONS.has(nextAction);
}

export function isServicesListQuestion(message: string): boolean {
  return SERVICES_LIST_PATTERN.test(message);
}

export function isHoursFaqQuestion(message: string): boolean {
  return HOURS_FAQ_PATTERN.test(message) && !AVAILABILITY_QUESTION_PATTERN.test(message);
}

export function isRequirementsFaqQuestion(message: string): boolean {
  return REQUIREMENTS_FAQ_PATTERN.test(message);
}

/** Client is asking for different days/times rather than picking proposed slot 1/2/3. */
export function looksLikeAvailabilityPreference(message: string): boolean {
  if (AVAILABILITY_QUESTION_PATTERN.test(message)) return true;
  if (
    /\b(thursday|friday|saturday|sunday|monday|tuesday|wednesday|tomorrow|today)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bbetween\b.+\b(and|&)\b/i.test(message)) return true;
  if (/\b(morning|afternoon|evening|after\s+\d|before\s+\d|from\s+\d)\b/i.test(message)) {
    return true;
  }
  if (/\b(any|other|different)\s+(times?|slots?|days?)\b/i.test(message)) return true;
  if (/\bwhat (times?|days?)\b/i.test(message)) return true;
  return false;
}

function formatOfferingsCatalogue(
  offerings: ConversationTurnContext['stylistContext']['offerings'],
): string {
  if (offerings.length === 0) {
    return 'We do not have services listed yet — I can ask the stylist to confirm what they offer.';
  }

  return offerings
    .map((offering) => {
      const tiers = [offering.sizeTier, offering.lengthTier].filter(Boolean).join(', ');
      return `• ${offering.styleName}${tiers ? ` (${tiers})` : ''}: £${offering.basePrice}, about ${formatDurationLabel(offering.estimatedDurationMinutes)}`;
    })
    .join('\n');
}

function formatRequirementsForOffering(
  context: ConversationTurnContext,
  styleName: string | null | undefined,
): string | null {
  if (!styleName) return null;
  const normalized = styleName.toLowerCase();
  const offering = context.stylistContext.offerings.find(
    (item) => item.styleName.toLowerCase() === normalized,
  );
  if (!offering || offering.requirements.length === 0) {
    return null;
  }
  return `For ${offering.styleName}: ${offering.requirements.join('; ')}`;
}

/**
 * Append authoritative catalogue facts to FAQ replies so the app owns services/hours/requirements.
 * Keeps the model's conversational lead-in when present.
 */
export function enrichFaqClientMessage(
  context: ConversationTurnContext,
  clientMessage: string,
): string {
  const latest = context.latestClientMessage;
  const leadIn = clientMessage.trim();
  const parts: string[] = [];

  if (isServicesListQuestion(latest)) {
    const catalogue = formatOfferingsCatalogue(context.stylistContext.offerings);
    const intro =
      leadIn && !/£|\babout\b/i.test(leadIn)
        ? leadIn
        : 'Here is what we currently offer:';
    parts.push(`${intro}\n\n${catalogue}`);
    if (context.stylistContext.offerings.length > 0) {
      parts.push('Which style are you interested in?');
    }
    return parts.join('\n\n');
  }

  if (isHoursFaqQuestion(latest)) {
    const hours = context.stylistContext.workingHoursSummary || 'Hours are not listed yet.';
    const intro = leadIn && !/open|hour/i.test(leadIn) ? leadIn : 'Our working hours:';
    return `${intro}\n\n${hours}`;
  }

  if (isRequirementsFaqQuestion(latest)) {
    const styleName =
      context.mergedSlots.styleName ??
      context.stylistContext.offerings.find((o) =>
        latest.toLowerCase().includes(o.styleName.toLowerCase()),
      )?.styleName;
    const requirements = formatRequirementsForOffering(context, styleName);
    if (requirements) {
      const intro = leadIn || 'Here are the requirements:';
      return `${intro}\n\n${requirements}`;
    }
  }

  return clientMessage;
}
