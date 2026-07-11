const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);

function normalizeKeyword(body: string): string {
  return body
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function isStopKeyword(body: string): boolean {
  const normalized = normalizeKeyword(body);
  return STOP_KEYWORDS.has(normalized);
}

export function isStartKeyword(body: string): boolean {
  const normalized = normalizeKeyword(body);
  return START_KEYWORDS.has(normalized);
}

export function stopConfirmationMessage(platformName: string): string {
  return `${platformName}: You've been unsubscribed from automated messages. Booking confirmations and reminders will still be sent. Reply START to re-enable the assistant.`;
}

export function startConfirmationMessage(platformName: string): string {
  return `${platformName}: You're subscribed again. Our booking assistant can help you by text.`;
}
