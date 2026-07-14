'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { SavedStylist } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function ClientSavedStylistsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const savedQuery = useQuery({
    queryKey: ['client', 'saved-stylists'],
    queryFn: () => apiFetchData<SavedStylist[]>('/clients/me/saved-stylists'),
  });

  const removeMutation = useMutation({
    mutationFn: (stylistId: string) =>
      apiFetchData(`/clients/me/saved-stylists/${stylistId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'saved-stylists'] });
    },
  });

  async function handleRemove(stylistId: string) {
    setError(null);
    try {
      await removeMutation.mutateAsync(stylistId);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const stylists = savedQuery.data ?? [];

  return (
    <PageShell>
      <PageHeader title="Saved stylists" subtitle="Quick links to book again." />

      <div className="mt-6 space-y-3">
        {savedQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : stylists.length === 0 ? (
          <EmptyState
            title="No saved stylists yet"
            description="Save a stylist from the directory to find them here quickly."
            action={{ label: 'Browse directory', href: '/directory' }}
          />
        ) : (
          stylists.map((stylist) => (
            <Card key={stylist.stylistId} className="space-y-2">
              <p className="font-medium text-ink">{stylist.businessName}</p>
              {stylist.locationArea ? (
                <p className="text-sm text-ink-muted">{stylist.locationArea}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={
                    stylist.directoryVisible
                      ? `/directory/${stylist.stylistId}`
                      : `/book?stylistId=${stylist.stylistId}`
                  }
                  className={TOUCH_LINK_CLASS}
                >
                  View & book →
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => void handleRemove(stylist.stylistId)}
                  disabled={removeMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </PageShell>
  );
}
