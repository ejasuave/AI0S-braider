'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/shared/lib/api-client';
import { usePingWithPagination } from '@/features/system/usePingWithPagination';

export function useSystemHealth() {
  const ping = usePingWithPagination();

  const db = useQuery({
    queryKey: ['system', 'health', 'db'],
    queryFn: () => fetchHealth('/health/db'),
    staleTime: 10_000,
    retry: 1,
    enabled: ping.isSuccess,
  });

  return { ping, db };
}
