'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ConversationDetail } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function messageCardClass(sender: string): string | undefined {
  switch (sender) {
    case 'stylist':
      return 'border-primary/30 bg-primary-subtle';
    case 'ai':
      return 'border-ai/30 bg-ai/5';
    default:
      return undefined;
  }
}

function senderLabel(sender: string): string {
  switch (sender) {
    case 'client':
      return 'Client';
    case 'ai':
      return 'Assistant';
    case 'stylist':
      return 'You';
    case 'system':
      return 'System';
    default:
      return sender;
  }
}

export default function StylistConversationPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const conversationQuery = useQuery({
    queryKey: ['messaging', 'conversation', params.id],
    queryFn: () => apiFetchData<ConversationDetail>(`/messaging/conversations/${params.id}`),
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetchData<ConversationDetail>(`/messaging/conversations/${params.id}/messages`, {
        method: 'POST',
        json: { content },
      }),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<ConversationDetail>(`/messaging/conversations/${params.id}/resolve-escalation`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
    },
  });

  const conversation = conversationQuery.data;
  const isEscalated = conversation?.status === 'escalated';

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!reply.trim()) return;
    try {
      await replyMutation.mutateAsync(reply.trim());
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleResolve() {
    setError(null);
    try {
      await resolveMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <PageHeader title="Conversation" backHref="/stylist/inbox" />

      {conversationQuery.isLoading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : conversation ? (
        <div className="mt-6 space-y-4">
          <Card className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium text-ink">{conversation.clientPhoneNumber}</p>
              <StatusBadge
                label={isEscalated ? 'Needs reply' : conversation.status}
                tone={isEscalated ? 'warning' : 'neutral'}
                className="shrink-0"
              />
            </div>
            {conversation.openEscalation ? (
              <div className="space-y-1 text-sm text-warning">
                <p>Escalation: {conversation.openEscalation.reason}</p>
                {conversation.openEscalation.modelConfidence != null ? (
                  <p className="text-ink-muted">
                    AI confidence: {conversation.openEscalation.modelConfidence.toFixed(2)}
                    {conversation.openEscalation.modelNextAction
                      ? ` · proposed action: ${conversation.openEscalation.modelNextAction}`
                      : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <div className="space-y-3">
            {conversation.messages.map((message) => (
              <Card key={message.id} className={messageCardClass(message.sender)}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-ink-muted">
                  <span className={message.sender === 'ai' ? 'font-medium text-ai' : undefined}>
                    {senderLabel(message.sender)}
                  </span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{message.content}</p>
                {message.deliveryStatus && message.sender !== 'client' ? (
                  <p className="mt-1 text-xs text-ink-muted">Delivery: {message.deliveryStatus}</p>
                ) : null}
              </Card>
            ))}
          </div>

          {error ? <p className="text-sm text-error">{error}</p> : null}

          {isEscalated ? (
            <div id="reply-composer" className="scroll-mt-4">
              <Card className="space-y-3">
                <form className="space-y-3" onSubmit={handleReply}>
                  <Textarea
                    label="Your reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onFocus={(e) => {
                      e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }}
                    placeholder="Reply to your client…"
                    required
                  />
                  <Button type="submit" fullWidth disabled={replyMutation.isPending}>
                    {replyMutation.isPending ? 'Sending…' : 'Send reply'}
                  </Button>
                </form>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => void handleResolve()}
                  disabled={resolveMutation.isPending}
                >
                  {resolveMutation.isPending ? 'Resolving…' : 'Return to AI assistant'}
                </Button>
              </Card>
            </div>
          ) : (
            <Card>
              <p className="text-sm text-ink-muted">
                The AI assistant is handling this thread. You can reply once a conversation is
                escalated to you.
              </p>
            </Card>
          )}
        </div>
      ) : (
        <p className="mt-6 text-sm text-error">Conversation not found.</p>
      )}
    </PageShell>
  );
}
