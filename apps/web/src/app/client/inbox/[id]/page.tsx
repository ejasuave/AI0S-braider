'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ConversationDetail } from '@project-braids/shared-types/api';
import { fetchClientConversation, sendClientMessage } from '@/features/messaging/api';
import { getApiErrorMessage } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function messageCardClass(sender: string): string | undefined {
  switch (sender) {
    case 'client':
      return 'border-primary/30 bg-primary-subtle';
    case 'ai':
      return 'border-ai/30 bg-ai/5';
    case 'stylist':
      return 'border-border bg-surface';
    default:
      return undefined;
  }
}

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
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery({
    queryKey: ['messaging', 'client', 'conversation', params.id],
    queryFn: () => fetchClientConversation(params.id),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendClientMessage(params.id, content),
    onSuccess: (detail) => {
      setDraft('');
      queryClient.setQueryData<ConversationDetail>(
        ['messaging', 'client', 'conversation', params.id],
        detail,
      );
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'client', 'conversations'] });
    },
  });

  const conversation = conversationQuery.data;
  const isOpen = conversation?.status === 'active' || conversation?.status === 'escalated';
  const isEscalated = conversation?.status === 'escalated';
  const canCompose = conversation?.channel === 'web' && isOpen;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length, sendMutation.isPending]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const content = draft.trim();
    if (!content) return;
    try {
      await sendMutation.mutateAsync(content);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-lg flex-col px-4 pt-6 md:max-w-2xl pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <div className="shrink-0 space-y-3">
        <PageHeader
          title={conversation?.stylistBusinessName ?? 'Conversation'}
          subtitle={
            isEscalated
              ? 'A stylist has taken over — keep messaging here.'
              : 'Chat with the AI receptionist in the app.'
          }
          backHref="/client/inbox"
        />
        {conversation ? <StatusBadge label={conversation.status} tone="neutral" /> : null}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        {conversationQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          conversation?.messages.map((message) => (
            <Card key={message.id} className={messageCardClass(message.sender)}>
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
        <div ref={messagesEndRef} className="h-1 shrink-0" aria-hidden />
      </div>

      {canCompose ? (
        <form
          onSubmit={(event) => void handleSend(event)}
          className="shrink-0 border-t border-border bg-surface pt-3"
        >
          {isEscalated ? (
            <p className="mb-2 text-xs text-ink-muted">
              AI is paused while a stylist handles this chat.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Textarea
              id="client-reply-composer"
              aria-label="Message"
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message…"
              disabled={sendMutation.isPending}
            />
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <Button type="submit" fullWidth disabled={sendMutation.isPending || !draft.trim()}>
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      ) : conversation && conversation.channel !== 'web' ? (
        <Card className="mt-4 shrink-0 space-y-1">
          <p className="text-sm font-medium text-ink">SMS thread</p>
          <p className="text-sm text-ink-muted">
            This conversation started over SMS. Start a new in-app chat from the stylist&apos;s
            profile.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
