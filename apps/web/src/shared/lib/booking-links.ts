/** Public direct-booking URL — client picks a service on the booking page. */
export function stylistBookingPath(stylistId: string): string {
  return `/book?stylistId=${stylistId}`;
}

/** Public direct-booking URL for a single service (skips service picker). */
export function serviceBookingPath(stylistId: string, serviceOfferingId: string): string {
  return `/book?stylistId=${stylistId}&serviceOfferingId=${serviceOfferingId}`;
}

export function stylistBookingUrl(stylistId: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${stylistBookingPath(stylistId)}`;
}

export function serviceBookingUrl(
  stylistId: string,
  serviceOfferingId: string,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${serviceBookingPath(stylistId, serviceOfferingId)}`;
}

/** Absolute URL for a vanity share path (`/stylist/...`). */
export function absoluteShareUrl(sharePath: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${sharePath.startsWith('/') ? sharePath : `/${sharePath}`}`;
}

export {
  buildServiceSharePath,
  buildServiceSharePathFromOffering,
  servicePathSegments,
  slugify,
} from '@project-braids/shared-types/api';
