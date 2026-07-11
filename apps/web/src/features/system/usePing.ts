'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPing } from '@/shared/lib/api-client';

export function usePing() {
  return useQuery({
    queryKey: ['system', 'ping'],
    queryFn: () => fetchPing(),
    staleTime: 10_000,
  });
}
