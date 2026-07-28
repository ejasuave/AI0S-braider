import type { ExtractedSlots } from '@project-braids/shared-types/api';
import type { ConversationTurnContext } from './context.js';

export type StylistOffering = ConversationTurnContext['stylistContext']['offerings'][number];

const ADDONS_NONE_PATTERN =
  /\b(no add-?ons?|none|no thanks|without add-?ons?|just the (style|braids|service)|no extras|skip add-?ons?)\b/i;

export function clientDeclinesAddons(message: string): boolean {
  return ADDONS_NONE_PATTERN.test(message);
}

export function findOfferingForSlots(
  offerings: StylistOffering[],
  slots: Pick<ExtractedSlots, 'serviceOfferingId' | 'styleName' | 'sizeTier' | 'lengthTier'>,
): StylistOffering | undefined {
  if (slots.serviceOfferingId) {
    const byId = offerings.find((item) => item.id === slots.serviceOfferingId);
    if (byId) return byId;
  }
  if (!slots.styleName) return undefined;

  const style = slots.styleName.trim().toLowerCase();
  const matches = offerings.filter((item) => item.styleName.toLowerCase() === style);
  if (matches.length === 0) {
    const loose = offerings.filter((item) => item.styleName.toLowerCase().includes(style));
    return pickTierMatch(loose, slots);
  }
  return pickTierMatch(matches, slots);
}

function pickTierMatch(
  matches: StylistOffering[],
  slots: Pick<ExtractedSlots, 'sizeTier' | 'lengthTier'>,
): StylistOffering | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const filtered = matches.filter((item) => {
    if (
      slots.sizeTier &&
      item.sizeTier &&
      item.sizeTier.toLowerCase() !== slots.sizeTier.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      slots.lengthTier &&
      item.lengthTier &&
      item.lengthTier.toLowerCase() !== slots.lengthTier.trim().toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  return filtered.length === 1 ? filtered[0] : filtered[0] ?? matches[0];
}

export function offeringsForStyleName(
  offerings: StylistOffering[],
  styleName: string,
): StylistOffering[] {
  const style = styleName.trim().toLowerCase();
  const exact = offerings.filter((item) => item.styleName.toLowerCase() === style);
  if (exact.length > 0) return exact;
  return offerings.filter((item) => item.styleName.toLowerCase().includes(style));
}

/** When a style has multiple size/length variants and the client has not picked one. */
export function missingTierClarification(
  offerings: StylistOffering[],
  slots: Pick<ExtractedSlots, 'styleName' | 'sizeTier' | 'lengthTier'>,
): { field: 'sizeTier' | 'lengthTier'; options: string[] } | null {
  if (!slots.styleName) return null;
  const matches = offeringsForStyleName(offerings, slots.styleName);
  if (matches.length <= 1) return null;

  const sizes = [
    ...new Set(matches.map((item) => item.sizeTier).filter((value): value is string => Boolean(value))),
  ];
  if (sizes.length > 1 && !slots.sizeTier) {
    return { field: 'sizeTier', options: sizes };
  }

  const lengths = [
    ...new Set(
      matches.map((item) => item.lengthTier).filter((value): value is string => Boolean(value)),
    ),
  ];
  if (lengths.length > 1 && !slots.lengthTier) {
    return { field: 'lengthTier', options: lengths };
  }

  return null;
}

export function offeringNeedsAddonConfirmation(offering: StylistOffering | undefined): boolean {
  return Boolean(offering && offering.addons.length > 0);
}

export function resolveAddonIds(
  offering: StylistOffering | undefined,
  addonNames: string[] | undefined,
): string[] {
  if (!offering || !addonNames || addonNames.length === 0) {
    return [];
  }

  const ids: string[] = [];
  for (const name of addonNames) {
    const normalized = name.trim().toLowerCase();
    const match = offering.addons.find((addon) => addon.name.toLowerCase() === normalized);
    if (match) {
      ids.push(match.id);
    }
  }
  return ids;
}

export function sumSelectedAddonPrices(
  offering: StylistOffering | undefined,
  addonNames: string[] | undefined,
): number {
  if (!offering || !addonNames || addonNames.length === 0) return 0;
  let total = 0;
  for (const name of addonNames) {
    const normalized = name.trim().toLowerCase();
    const match = offering.addons.find((addon) => addon.name.toLowerCase() === normalized);
    if (match) {
      total += Number(match.price);
    }
  }
  return total;
}

export function formatPriceQuote(
  offering: StylistOffering,
  addonNames: string[] | undefined,
): { total: number; line: string; requirementsNote: string } {
  const addonTotal = sumSelectedAddonPrices(offering, addonNames);
  const base = Number(offering.basePrice);
  const total = Math.round((base + addonTotal) * 100) / 100;
  const selected =
    addonNames && addonNames.length > 0
      ? offering.addons.filter((addon) =>
          addonNames.some((name) => name.trim().toLowerCase() === addon.name.toLowerCase()),
        )
      : [];

  const addonPart =
    selected.length > 0
      ? ` (includes ${selected.map((addon) => `${addon.name} £${addon.price}`).join(', ')})`
      : '';

  const requirementsNote =
    offering.requirements.length > 0
      ? `\n\nPlease note: ${offering.requirements.join('; ')}.`
      : '';

  return {
    total,
    line: `${offering.styleName}: £${total.toFixed(2)}, about ${offering.estimatedDurationMinutes} mins${addonPart}.`,
    requirementsNote,
  };
}

export function formatAddonsPrompt(offering: StylistOffering): string {
  const list = offering.addons.map((addon) => `${addon.name} (£${addon.price})`).join(', ');
  return `Any add-ons for ${offering.styleName}? We offer: ${list}. Reply with what you want, or "none".`;
}
