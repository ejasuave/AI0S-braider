'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { SavedStylist } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { Button } from '@/shared/ui/button';

type Props = {
  stylistId: string;
  fullWidth?: boolean;
  className?: string;
};

export function SaveStylistButton({ stylistId, fullWidth, className }: Props) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const savedQuery = useQuery({
    queryKey: ['client', 'saved-stylists'],
    queryFn: () => apiFetchData<SavedStylist[]>('/clients/me/saved-stylists'),
    enabled: auth.isAuthenticated && auth.isClient,
  });

  const isSaved = (savedQuery.data ?? []).some((row) => row.stylistId === stylistId);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<SavedStylist[]>('/clients/me/saved-stylists', {
        method: 'POST',
        json: { stylistId },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['client', 'saved-stylists'], data);
      setError(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      apiFetchData(`/clients/me/saved-stylists/${stylistId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'saved-stylists'] });
      setError(null);
    },
  });

  if (!auth.isAuthenticated || !auth.isClient) {
    return (
      <div className={className}>
        <Link href={`/login/client?next=${encodeURIComponent(`/directory/${stylistId}`)}`}>
          <Button type="button" variant="secondary" fullWidth={fullWidth}>
            Sign in to save stylist
          </Button>
        </Link>
        <p className="mt-2 text-center text-xs text-ink-muted">
          Or{' '}
          <Link href="/register/client" className={TOUCH_LINK_CLASS}>
            create a client account
          </Link>
        </p>
      </div>
    );
  }

  const pending = saveMutation.isPending || removeMutation.isPending;

  return (
    <div className={className}>
      <Button
        type="button"
        variant={isSaved ? 'secondary' : 'primary'}
        fullWidth={fullWidth}
        disabled={pending || savedQuery.isLoading}
        onClick={() => {
          setError(null);
          if (isSaved) {
            removeMutation.mutate(undefined, {
              onError: (err) => setError(getApiErrorMessage(err, 'Could not remove stylist.')),
            });
          } else {
            saveMutation.mutate(undefined, {
              onError: (err) => setError(getApiErrorMessage(err, 'Could not save stylist.')),
            });
          }
        }}
      >
        {pending ? 'Saving…' : isSaved ? 'Saved — tap to remove' : 'Save stylist'}
      </Button>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
