import type { ConversationListResponse } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';

export async function fetchStylistConversations(query: string): Promise<ConversationListResponse> {
  return apiFetchData<ConversationListResponse>(`/messaging/conversations${query}`);
}

export async function fetchClientConversations(): Promise<ConversationListResponse> {
  return apiFetchData<ConversationListResponse>('/messaging/client/conversations');
}
