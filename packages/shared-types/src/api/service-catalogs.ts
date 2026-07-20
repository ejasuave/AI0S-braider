/**
 * Preloaded catalogs for service requirements and add-ons (stylist feedback).
 * Single source of truth for API + web UI.
 */

export const REQUIREMENTS_CATALOG = [
  { key: 'hair_washed_blowdried', text: 'Hair must be washed and blow-dried' },
  { key: 'hair_detangled', text: 'Hair must be detangled' },
  { key: 'bring_own_hair', text: 'Bring your own hair' },
  { key: 'no_extra_guests', text: 'No extra guests' },
  { key: 'arrive_10_min_early', text: 'Arrive 10 minutes early' },
  { key: 'deposit_required', text: 'Deposit required' },
  { key: 'patch_test_required', text: 'Patch test required' },
  { key: 'children_not_permitted', text: 'Children not permitted' },
] as const;

export type RequirementCatalogKey = (typeof REQUIREMENTS_CATALOG)[number]['key'];

export const ADDONS_CATALOG = [
  { key: 'hair_wash', name: 'Hair Wash', defaultPrice: 15 },
  { key: 'hair_treatment', name: 'Hair Treatment', defaultPrice: 25 },
  { key: 'hair_trim', name: 'Hair Trim', defaultPrice: 10 },
  { key: 'extra_length', name: 'Extra Length', defaultPrice: 20 },
  { key: 'premium_hair', name: 'Premium Hair', defaultPrice: 40 },
  { key: 'boho_curls', name: 'Boho Curls', defaultPrice: 30 },
  { key: 'beads', name: 'Beads', defaultPrice: 15 },
  { key: 'extra_thickness', name: 'Extra Thickness', defaultPrice: 25 },
] as const;

export type AddonCatalogKey = (typeof ADDONS_CATALOG)[number]['key'];

/** Canonical length tiers including stylist-requested Bum Length. */
export const DEFAULT_LENGTH_TIERS = [
  'Shoulder',
  'Mid-back',
  'Waist-length',
  'Hip-length',
  'Bum Length',
] as const;

export const DURATION_MINUTE_STEPS = [0, 15, 30, 45] as const;
export const MAX_DURATION_HOURS = 12;

export function minutesToParts(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.floor(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function partsToMinutes(hours: number, minutes: number): number {
  const h = Math.max(0, Math.min(MAX_DURATION_HOURS, Math.floor(hours)));
  const m = DURATION_MINUTE_STEPS.includes(minutes as (typeof DURATION_MINUTE_STEPS)[number])
    ? minutes
    : Math.round(minutes / 15) * 15;
  return h * 60 + Math.min(45, Math.max(0, m));
}

/** Human-readable duration, e.g. "2h 15m", "45m", "1h". */
export function formatDurationLabel(totalMinutes: number): string {
  const { hours, minutes } = minutesToParts(totalMinutes);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export const REMAINING_BALANCE_METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'cash_or_card',
  'cash_or_bank_transfer',
  'card_or_bank_transfer',
  'any',
] as const;

export type RemainingBalanceMethod = (typeof REMAINING_BALANCE_METHODS)[number];

export const remainingBalanceMethodLabel: Record<RemainingBalanceMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cash_or_card: 'Cash or Card',
  cash_or_bank_transfer: 'Cash or Bank Transfer',
  card_or_bank_transfer: 'Card or Bank Transfer',
  any: 'Any Payment Method',
};

/** True when the client may pay the remaining balance online via card/Stripe. */
export function remainingBalanceAllowsOnlineCard(
  method: RemainingBalanceMethod | null | undefined,
): boolean {
  if (!method) return true;
  return (
    method === 'card' ||
    method === 'cash_or_card' ||
    method === 'card_or_bank_transfer' ||
    method === 'any'
  );
}

export const serviceCatalogsResponseSchema = {
  requirements: REQUIREMENTS_CATALOG,
  addons: ADDONS_CATALOG,
  lengthTiers: DEFAULT_LENGTH_TIERS,
  remainingBalanceMethods: REMAINING_BALANCE_METHODS,
} as const;
