'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import type { BusinessProfile } from '@project-braids/shared-types/api';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StylistProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['business', 'me'],
    queryFn: () => apiFetchData<BusinessProfile>('/businesses/me'),
  });

  const [businessName, setBusinessName] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setBusinessName(profileQuery.data.businessName);
      setLocationLabel(profileQuery.data.locationLabel ?? '');
      setBio(profileQuery.data.bio ?? '');
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<BusinessProfile>('/businesses/me', {
        method: 'PATCH',
        json: {
          businessName,
          locationLabel: locationLabel || null,
          bio: bio || null,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'me'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiFetchData<BusinessProfile>('/businesses/me/onboarding-status', {
        method: 'PATCH',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'me'] });
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

  async function handleCompleteOnboarding() {
    setError(null);
    try {
      await completeMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const onboardingStatus = profileQuery.data?.onboardingStatus ?? 'in_progress';

  return (
    <PageShell>
      <PageHeader title="Profile" subtitle="Your business details — save each section independently." />

      <div className="mt-6 space-y-4">
        <Card>
          {profileQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading profile…</p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                label="Location area"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                hint="e.g. South London, Peckham"
              />
              <Textarea
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell clients about your work…"
              />
              {error ? <p className="text-sm text-error">{error}</p> : null}
              {saved ? <p className="text-sm text-success">Profile saved.</p> : null}
              <Button type="submit" fullWidth disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          )}
        </Card>

        {onboardingStatus === 'in_progress' ? (
          <Card className="space-y-3">
            <p className="text-sm text-ink-muted">
              Complete onboarding after you add at least one service and set working hours.
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleCompleteOnboarding()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Checking…' : 'Mark onboarding complete'}
            </Button>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-success">Onboarding complete.</p>
          </Card>
        )}

        <SignOutButton />
      </div>
    </PageShell>
  );
}
