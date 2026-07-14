'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { ConversationDetail } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function senderLabel(sender: string): string {
  switch (sender) {
    case 'client':
      return 'You';
    case 'ai':
      return 'Assistant';
    case 'stylist':
      return 'Stylist';
    case 'system':
      return 'System';
    default:
      return sender;
  }
}

export default function ClientConversationPage() {
  const params = useParams<{ id: string }>();

  const conversationQuery = useQuery({
    queryKey: ['messaging', 'client', 'conversation', params.id],
    queryFn: () => apiFetchData<ConversationDetail>(`/messaging/client/conversations/${params.id}`),
  });

  const conversation = conversationQuery.data;

  return (
    <PageShell>
      <PageHeader
        title={conversation?.stylistBusinessName ?? 'Conversation'}
        subtitle="Reply by texting the stylist's booking number."
      />

      <div className="mt-4">
        {conversation ? <StatusBadge label={conversation.status} tone="neutral" /> : null}
      </div>

      <div className="mt-6 space-y-3">
        {conversationQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          conversation?.messages.map((message) => (
            <Card key={message.id}>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                  <span>{senderLabel(message.sender)}</span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{message.content}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
