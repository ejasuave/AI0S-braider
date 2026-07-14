'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchStylistConversations } from '@/features/messaging/api';

export function useEscalationCount() {
  return useQuery({
    queryKey: ['messaging', 'conversations', 'escalated'],
    queryFn: () => fetchStylistConversations('?escalatedOnly=true'),
    select: (data) => data.items.length,
  });
}
