import type { ServiceVenueMode } from '@project-braids/shared-types/api';

export function serviceVenueModeLabel(mode: ServiceVenueMode): string {
  switch (mode) {
    case 'remote':
      return 'Remote';
    case 'stylist_location':
      return 'At stylist location';
    case 'come_to_client':
      return 'Home visit (come to client)';
    default:
      return mode;
  }
}
