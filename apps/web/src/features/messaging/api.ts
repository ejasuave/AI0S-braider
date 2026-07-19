import type {
  ConversationDetail,
  ConversationListResponse,
  StartClientConversationResponse,
} from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';

export async function fetchStylistConversations(query: string): Promise<ConversationListResponse> {
  return apiFetchData<ConversationListResponse>(`/messaging/conversations${query}`);
}

export async function fetchClientConversations(): Promise<ConversationListResponse> {
  return apiFetchData<ConversationListResponse>('/messaging/client/conversations');
}

export async function startClientConversation(
  stylistId: string,
): Promise<StartClientConversationResponse> {
  return apiFetchData<StartClientConversationResponse>('/messaging/client/conversations', {
    method: 'POST',
    json: { stylistId },
  });
}

export async function sendClientMessage(
  conversationId: string,
  content: string,
): Promise<ConversationDetail> {
  return apiFetchData<ConversationDetail>(
    `/messaging/client/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      json: { content },
    },
  );
}

export async function fetchClientConversation(conversationId: string): Promise<ConversationDetail> {
  return apiFetchData<ConversationDetail>(`/messaging/client/conversations/${conversationId}`);
}
