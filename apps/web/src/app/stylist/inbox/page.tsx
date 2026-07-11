'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ConversationSummary } from '@project-braids/shared-types/api';
import { fetchStylistConversations } from '@/features/messaging/api';
import { formatDateTime } from '@/shared/lib/format';
import { Card } from '@/shared/ui/card';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  return (
    <Link href={`/stylist/inbox/${conversation.id}`} className="block active:opacity-95">
      <Card className="transition-shadow active:shadow-raised">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium text-ink">
              {conversation.clientPhoneNumber ?? 'Client'}
            </p>
            <p className="line-clamp-2 text-sm text-ink-muted">
              {conversation.lastMessagePreview ?? 'No messages yet'}
            </p>
            <p className="text-xs text-ink-muted">{formatDateTime(conversation.lastMessageAt)}</p>
          </div>
          <StatusBadge
            label={conversation.status === 'escalated' ? 'Needs reply' : conversation.status}
            tone={conversation.status === 'escalated' ? 'warning' : 'neutral'}
            className="shrink-0"
          />
        </div>
      </Card>
    </Link>
  );
}

export default function StylistInboxPage() {
  const escalatedQuery = useQuery({
    queryKey: ['messaging', 'conversations', 'escalated'],
    queryFn: () => fetchStylistConversations('?escalatedOnly=true'),
  });

  const allQuery = useQuery({
    queryKey: ['messaging', 'conversations', 'all'],
    queryFn: () => fetchStylistConversations(''),
  });

  const escalated = escalatedQuery.data?.items ?? [];
  const escalatedIds = new Set(escalated.map((c) => c.id));
  const other = (allQuery.data?.items ?? []).filter((c) => !escalatedIds.has(c.id));
  const loading = escalatedQuery.isLoading || allQuery.isLoading;

  return (
    <PageShell>
      <PageHeader title="Inbox" subtitle="SMS conversations with clients — reply when escalated." />

      <div className="mt-6 space-y-6" aria-live="polite">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-medium text-ink">Needs your reply</h2>
              {escalated.length === 0 ? (
                <p className="text-sm text-ink-muted">No escalated conversations right now.</p>
              ) : (
                escalated.map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} />
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-medium text-ink">All conversations</h2>
              {other.length === 0 ? (
                <EmptyState
                  title="No other conversations"
                  description="When clients text your SMS booking number, threads appear here."
                />
              ) : (
                other.map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
