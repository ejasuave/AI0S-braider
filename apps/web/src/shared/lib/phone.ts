/** Normalise UK-style input to E.164 before API submission. */
export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim().replace(/[\s-]/g, '');
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`;
  if (trimmed.startsWith('0')) return `+44${trimmed.slice(1)}`;
  // UK mobile without leading zero, e.g. 7700900123
  if (/^7\d{9}$/.test(trimmed)) return `+44${trimmed}`;
  return `+${trimmed}`;
}

export function isValidE164Phone(phoneNumber: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phoneNumber);
}

export function formatPhoneHint(): string {
  return 'e.g. 07700900123, 7700900123, or +447700900123';
}
