'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPing } from '@/shared/lib/api-client';
import type { PaginationParams } from '@project-braids/shared-types/api';

/** Ch.2.3/2.4 — proof-of-concept hook using shared PaginationParams with ping. */
export function usePingWithPagination(params?: Partial<PaginationParams>) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;

  return useQuery({
    queryKey: ['system', 'ping', { page, pageSize }],
    queryFn: () => fetchPing({ page, pageSize }),
    staleTime: 10_000,
  });
}
