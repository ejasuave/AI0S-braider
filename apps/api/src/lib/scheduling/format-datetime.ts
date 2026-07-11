export function formatSlotLabel(startTime: string | Date, timeZone: string): string {
  const date = typeof startTime === 'string' ? new Date(startTime) : startTime;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
