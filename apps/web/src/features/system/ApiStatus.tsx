'use client';

import { usePing } from '@/features/system/usePing';

export function ApiStatus() {
  const { data, isLoading, isError, error } = usePing();

  if (isLoading) {
    return <p className="text-sm text-brand-ink/60">Checking API connection…</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-red-700">
        API unreachable: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    );
  }

  return (
    <p className="text-sm text-brand-ink/70">
      API connected — ping received at {data?.timestamp}
    </p>
  );
}
