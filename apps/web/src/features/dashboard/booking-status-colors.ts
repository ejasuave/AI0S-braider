import type { BookingStatus } from '@project-braids/shared-types/api';

/** Tailwind background class for week-calendar status dots (Ch.17.2). */
export function statusDotClass(status: BookingStatus): string {
  switch (status) {
    case 'held':
      return 'bg-warning';
    case 'confirmed':
      return 'bg-primary';
    case 'completed':
      return 'bg-success';
    case 'cancelled':
    case 'no_show':
      return 'bg-ink-muted';
    default:
      return 'bg-primary';
  }
}
