'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ConversationSummary } from '@project-braids/shared-types/api';
import { fetchClientConversations } from '@/features/messaging/api';
import { formatDateTime } from '@/shared/lib/format';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { Card } from '@/shared/ui/card';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  return (
    <Link href={`/client/inbox/${conversation.id}`} className="block active:opacity-95">
      <Card className="transition-shadow active:shadow-raised">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium text-ink">
              {conversation.stylistBusinessName ?? 'Stylist'}
            </p>
            <p className="line-clamp-2 text-sm text-ink-muted">
              {conversation.lastMessagePreview ?? 'No messages yet'}
            </p>
            <p className="text-xs text-ink-muted">{formatDateTime(conversation.lastMessageAt)}</p>
          </div>
          <StatusBadge label={conversation.channel} tone="neutral" className="shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

export default function ClientInboxPage() {
  const conversationsQuery = useQuery({
    queryKey: ['messaging', 'client', 'conversations'],
    queryFn: fetchClientConversations,
  });

  const items = conversationsQuery.data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Messages"
        subtitle="In-app chats with stylists and their AI receptionist."
      />

      <div className="mt-6 space-y-3" aria-live="polite">
        {conversationsQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : items.length === 0 ? (
          <>
            <EmptyState
              title="No conversations yet"
              description="Open a stylist profile and tap Message AI receptionist to start chatting in the app."
            />
            <Card className="space-y-2">
              <p className="text-sm text-ink-muted">
                Browse the directory to find someone to message.
              </p>
              <Link href="/directory" className={TOUCH_LINK_CLASS}>
                Find a braider →
              </Link>
            </Card>
          </>
        ) : (
          items.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))
        )}
      </div>
    </PageShell>
  );
}
