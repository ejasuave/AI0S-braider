'use client';

import { useSystemHealth } from '@/features/system/useSystemHealth';
import type { DbHealthResponse } from '@project-braids/shared-types';

function isDbHealth(data: unknown): data is DbHealthResponse {
  return Boolean(data && typeof data === 'object' && 'database' in data);
}

export function ApiStatus() {
  const { ping, db } = useSystemHealth();

  if (ping.isLoading) {
    return <p className="text-sm text-ink-muted">Checking API connection…</p>;
  }

  if (ping.isError) {
    return (
      <div className="space-y-2 rounded-lg border border-error/20 bg-error/5 p-4 text-sm text-error">
        <p className="font-medium">API unreachable</p>
        <p>
          Start the stack with <code className="rounded bg-surface-raised px-1">pnpm infra:up</code>{' '}
          then <code className="rounded bg-surface-raised px-1">pnpm dev</code>.
        </p>
      </div>
    );
  }

  const dbData = isDbHealth(db.data) ? db.data : null;
  const dbOk = dbData?.status === 'ok' && dbData.database === 'connected';

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm text-ink-muted shadow-card">
      <p>
        <span className="font-medium text-ink">API</span> — connected (ping {ping.data?.timestamp}
        {ping.data?.meta
          ? ` · page ${ping.data.meta.page}, size ${ping.data.meta.pageSize}`
          : null}
        )
      </p>
      <p>
        <span className="font-medium text-ink">Database</span> — {db.isLoading && 'checking…'}
        {db.isError && 'check failed'}
        {!db.isLoading &&
          !db.isError &&
          (dbOk ? `connected (${dbData?.latencyMs}ms)` : 'disconnected')}
      </p>
      {!dbOk && !db.isLoading && (
        <p>
          Run <code className="rounded bg-surface-raised px-1">pnpm db:migrate:deploy</code> after{' '}
          <code className="rounded bg-surface-raised px-1">pnpm infra:up</code>.
        </p>
      )}
      <p>
        Full booking → deposit flow:{' '}
        <code className="rounded bg-surface-raised px-1">pnpm mvp:demo</code>
      </p>
    </div>
  );
}
