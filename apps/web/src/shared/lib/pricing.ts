/** Client-side deposit/total helpers mirroring booking/mappers calculateDepositAmount. */

export type DepositType = 'flat' | 'percentage';

export function calculateDepositAmount(
  total: number,
  depositType: DepositType | null | undefined,
  depositValue: number | null | undefined,
): number {
  if (!depositType || depositValue == null || depositValue <= 0 || total <= 0) {
    return 0;
  }
  if (depositType === 'flat') {
    return Math.min(total, depositValue);
  }
  return Math.round(((total * depositValue) / 100) * 100) / 100;
}

export function calculateBookingPriceSummary(input: {
  basePrice: number;
  addonPrices: number[];
  homeVisitSurcharge?: number;
  depositType: DepositType | null | undefined;
  depositValue: number | null | undefined;
}): {
  serviceSubtotal: number;
  addonsTotal: number;
  surcharge: number;
  total: number;
  deposit: number;
  remaining: number;
} {
  const addonsTotal = input.addonPrices.reduce((sum, n) => sum + n, 0);
  const surcharge = input.homeVisitSurcharge ?? 0;
  const serviceSubtotal = input.basePrice;
  const total = Math.round((serviceSubtotal + addonsTotal + surcharge) * 100) / 100;
  const deposit = calculateDepositAmount(total, input.depositType, input.depositValue);
  const remaining = Math.max(0, Math.round((total - deposit) * 100) / 100);
  return { serviceSubtotal, addonsTotal, surcharge, total, deposit, remaining };
}

export function remainingBalanceMethodLabel(
  method: 'cash' | 'card' | 'cash_or_card' | null | undefined,
): string {
  if (method === 'cash') return 'Cash only';
  if (method === 'card') return 'Card only';
  if (method === 'cash_or_card') return 'Cash or card';
  return 'Not specified';
}
