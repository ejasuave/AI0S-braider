'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { fetchStylistConversations } from '@/features/messaging/api';
import type { StylistProfile, StylistSmsBookingNumber } from '@project-braids/shared-types/api';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatPhoneHint, isValidE164Phone, normalizePhoneNumber } from '@/shared/lib/phone';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StylistProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiFetchData<StylistProfile>('/profile/me'),
  });

  const smsQuery = useQuery({
    queryKey: ['messaging', 'booking-number'],
    queryFn: () => apiFetchData<StylistSmsBookingNumber>('/messaging/booking-number'),
  });

  const escalatedQuery = useQuery({
    queryKey: ['messaging', 'conversations', 'escalated-count'],
    queryFn: () => fetchStylistConversations('?escalatedOnly=true'),
  });

  const [businessName, setBusinessName] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [bio, setBio] = useState('');
  const [directoryVisible, setDirectoryVisible] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [smsSaved, setSmsSaved] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [devFrom, setDevFrom] = useState('');
  const [devBody, setDevBody] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setBusinessName(profileQuery.data.businessName);
      setLocationArea(profileQuery.data.locationArea ?? '');
      setBio(profileQuery.data.bio ?? '');
      setDirectoryVisible(profileQuery.data.directoryVisible);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (smsQuery.data?.smsBookingNumber) {
      setSmsNumber(smsQuery.data.smsBookingNumber);
    }
  }, [smsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<StylistProfile>('/profile/me', {
        method: 'PATCH',
        json: {
          businessName,
          locationArea: locationArea || null,
          bio: bio || null,
          directoryVisible,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const smsMutation = useMutation({
    mutationFn: (number: string) =>
      apiFetchData<StylistSmsBookingNumber>('/messaging/booking-number', {
        method: 'PUT',
        json: { smsBookingNumber: number },
      }),
    onSuccess: () => {
      setSmsSaved(true);
      setSmsError(null);
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'booking-number'] });
      setTimeout(() => setSmsSaved(false), 2000);
    },
  });

  const devSmsMutation = useMutation({
    mutationFn: (input: { from: string; to: string; body: string }) =>
      apiFetchData<{ conversationId: string }>('/messaging/dev/inbound-sms', {
        method: 'POST',
        json: input,
        auth: false,
      }),
    onSuccess: () => {
      setDevBody('');
      setDevError(null);
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
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

  async function handleSaveSms(event: React.FormEvent) {
    event.preventDefault();
    setSmsError(null);
    const normalized = normalizePhoneNumber(smsNumber);
    if (!isValidE164Phone(normalized)) {
      setSmsError(`Enter a valid E.164 number. ${formatPhoneHint()}`);
      return;
    }
    try {
      await smsMutation.mutateAsync(normalized);
    } catch (err) {
      setSmsError(getApiErrorMessage(err));
    }
  }

  async function handleDevSms(event: React.FormEvent) {
    event.preventDefault();
    setDevError(null);
    const from = normalizePhoneNumber(devFrom);
    const to = normalizePhoneNumber(smsNumber);
    if (!isValidE164Phone(from) || !isValidE164Phone(to)) {
      setDevError(`Use valid E.164 numbers. ${formatPhoneHint()}`);
      return;
    }
    try {
      await devSmsMutation.mutateAsync({ from, to, body: devBody });
    } catch (err) {
      setDevError(getApiErrorMessage(err));
    }
  }

  const escalatedCount = escalatedQuery.data?.items.length ?? 0;

  return (
    <PageShell>
      <PageHeader title="Profile" subtitle="How clients see your business." />

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
                value={locationArea}
                onChange={(e) => setLocationArea(e.target.value)}
                hint="e.g. South London, Peckham"
              />
              <Textarea
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell clients about your work…"
              />
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  checked={directoryVisible}
                  onChange={(e) => setDirectoryVisible(e.target.checked)}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-ink">List in beta directory</span>
                  <span className="block text-xs text-ink-muted">
                    Opt in to appear on /directory. Requires business name, location area, and at
                    least one active service.
                  </span>
                </span>
              </label>
              {error ? <p className="text-sm text-error">{error}</p> : null}
              {saved ? <p className="text-sm text-success">Profile saved.</p> : null}
              <Button type="submit" fullWidth disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <form className="space-y-4" onSubmit={handleSaveSms}>
            <h2 className="font-medium text-ink">SMS booking number</h2>
            <p className="text-sm text-ink-muted">
              Clients text this number to reach your AI receptionist. Use your Twilio number in
              production; any E.164 number works in local dev.
            </p>
            <Input
              label="SMS number (E.164)"
              value={smsNumber}
              onChange={(e) => setSmsNumber(e.target.value)}
              placeholder="+447700900123"
              required
            />
            {smsError ? <p className="text-sm text-error">{smsError}</p> : null}
            {smsSaved ? <p className="text-sm text-success">SMS number saved.</p> : null}
            <Button type="submit" fullWidth disabled={smsMutation.isPending}>
              {smsMutation.isPending ? 'Saving…' : 'Save SMS number'}
            </Button>
          </form>
        </Card>

        {process.env.NODE_ENV !== 'production' && smsNumber ? (
          <Card>
            <form className="space-y-4" onSubmit={handleDevSms}>
              <h2 className="font-medium text-ink">Dev: simulate client SMS</h2>
              <p className="text-sm text-ink-muted">
                Test the AI receptionist without Twilio. Check Inbox after sending.
              </p>
              <Input
                label="Client phone (from)"
                value={devFrom}
                onChange={(e) => setDevFrom(e.target.value)}
                placeholder="+447700900456"
                required
              />
              <Textarea
                label="Message"
                value={devBody}
                onChange={(e) => setDevBody(e.target.value)}
                placeholder="Hi, I'd like box braids next week"
                required
              />
              {devError ? <p className="text-sm text-error">{devError}</p> : null}
              <Button type="submit" fullWidth disabled={devSmsMutation.isPending}>
                {devSmsMutation.isPending ? 'Sending…' : 'Simulate inbound SMS'}
              </Button>
            </form>
          </Card>
        ) : null}

        {escalatedCount > 0 ? (
          <Card className="border-warning/40 bg-warning/5">
            <p className="text-sm text-ink">
              {escalatedCount} conversation{escalatedCount === 1 ? '' : 's'} need your reply in
              Inbox.
            </p>
          </Card>
        ) : null}

        <SignOutButton />
      </div>
    </PageShell>
  );
}
