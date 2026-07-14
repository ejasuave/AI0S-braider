import { describe, expect, it } from 'vitest';
import {
  serviceBookingPath,
  serviceBookingUrl,
  stylistBookingPath,
  stylistBookingUrl,
} from './booking-links';

describe('booking-links', () => {
  const stylistId = '11111111-1111-1111-1111-111111111111';
  const offeringId = '22222222-2222-2222-2222-222222222222';

  it('builds stylist-level booking paths', () => {
    expect(stylistBookingPath(stylistId)).toBe(`/book?stylistId=${stylistId}`);
    expect(stylistBookingUrl(stylistId, 'https://app.example.com')).toBe(
      `https://app.example.com/book?stylistId=${stylistId}`,
    );
  });

  it('builds service-specific booking paths', () => {
    expect(serviceBookingPath(stylistId, offeringId)).toBe(
      `/book?stylistId=${stylistId}&serviceOfferingId=${offeringId}`,
    );
    expect(serviceBookingUrl(stylistId, offeringId, 'https://app.example.com')).toBe(
      `https://app.example.com/book?stylistId=${stylistId}&serviceOfferingId=${offeringId}`,
    );
  });
});
