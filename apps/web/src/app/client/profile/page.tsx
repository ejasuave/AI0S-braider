'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ClientProfile } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function ClientProfilePage() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['client', 'profile'],
    queryFn: () => apiFetchData<ClientProfile>('/clients/me'),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.displayName ?? '');
      setEmail(profileQuery.data.email ?? '');
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<ClientProfile>('/clients/me', {
        method: 'PATCH',
        json: {
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['client', 'profile'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader title="Profile" subtitle="Optional display name and email for your account." />

      <Card className="mt-6 space-y-4">
        {profileQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-sm text-ink-muted">
              Phone: {profileQuery.data?.phoneNumber ?? '—'} (canonical login)
            </p>
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How stylists see you"
            />
            <Input
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {saved ? <p className="text-sm text-success">Saved</p> : null}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
