'use client';

import { useQuery } from '@tanstack/react-query';
import type { Booking } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';

type StylistBookingsParams = {
  from?: string;
  to?: string;
  status?: Booking['status'];
};

function buildBookingsPath(params?: StylistBookingsParams): string {
  if (!params) return '/bookings';
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.status) search.set('status', params.status);
  const query = search.toString();
  return query ? `/bookings?${query}` : '/bookings';
}

export function useStylistBookings(params?: StylistBookingsParams) {
  return useQuery({
    queryKey: ['bookings', 'stylist', params ?? 'all'],
    queryFn: () => apiFetchData<Booking[]>(buildBookingsPath(params)),
  });
}
