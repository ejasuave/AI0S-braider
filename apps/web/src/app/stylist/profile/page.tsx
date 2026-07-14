'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { fetchStylistConversations } from '@/features/messaging/api';
import type {
  BusinessProfile,
  StylistProfile,
  StylistSmsBookingNumber,
} from '@project-braids/shared-types/api';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatPhoneHint, isValidE164Phone, normalizePhoneNumber } from '@/shared/lib/phone';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StylistAvatar } from '@/shared/ui/portfolio-gallery';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function StylistProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['business', 'me'],
    queryFn: () => apiFetchData<BusinessProfile>('/businesses/me'),
  });

  const stylistProfileQuery = useQuery({
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
  const [locationLabel, setLocationLabel] = useState('');
  const [bio, setBio] = useState('');
  const [offersStylistLocation, setOffersStylistLocation] = useState(true);
  const [offersComeToClient, setOffersComeToClient] = useState(false);
  const [offersRemote, setOffersRemote] = useState(false);
  const [workplaceAddress, setWorkplaceAddress] = useState('');
  const [homeVisitSurcharge, setHomeVisitSurcharge] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsSaved, setSmsSaved] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [devFrom, setDevFrom] = useState('');
  const [devBody, setDevBody] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      setBusinessName(profileQuery.data.businessName);
      setLocationLabel(profileQuery.data.locationLabel ?? '');
      setBio(profileQuery.data.bio ?? '');
      setOffersStylistLocation(profileQuery.data.offersStylistLocation);
      setOffersComeToClient(profileQuery.data.offersComeToClient);
      setOffersRemote(profileQuery.data.offersRemote);
      setWorkplaceAddress(profileQuery.data.workplaceAddress ?? '');
      setHomeVisitSurcharge(profileQuery.data.homeVisitSurcharge ?? '');
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (smsQuery.data?.smsBookingNumber) {
      setSmsNumber(smsQuery.data.smsBookingNumber);
    }
  }, [smsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<BusinessProfile>('/businesses/me', {
        method: 'PATCH',
        json: {
          businessName,
          locationLabel: locationLabel || null,
          bio: bio || null,
          offersStylistLocation,
          offersComeToClient,
          offersRemote,
          workplaceAddress: workplaceAddress.trim() || null,
          homeVisitSurcharge:
            homeVisitSurcharge.trim() === ''
              ? offersComeToClient
                ? 0
                : null
              : Number(homeVisitSurcharge),
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
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

  const directoryMutation = useMutation({
    mutationFn: (directoryVisible: boolean) =>
      apiFetchData<StylistProfile>('/profile/me', {
        method: 'PATCH',
        json: { directoryVisible },
      }),
    onSuccess: () => {
      setDirectoryError(null);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
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

  async function handleCompleteOnboarding() {
    setError(null);
    try {
      await completeMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleDirectoryToggle(checked: boolean) {
    setDirectoryError(null);
    try {
      await directoryMutation.mutateAsync(checked);
    } catch (err) {
      setDirectoryError(getApiErrorMessage(err));
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError(null);

    const rawType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    const contentType =
      rawType === 'image/jpeg' || rawType === 'image/png' || rawType === 'image/webp'
        ? rawType
        : null;
    if (!contentType) {
      setPhotoError(
        'Use a JPEG, PNG, or WebP photo. iPhone HEIC photos need to be converted to JPEG first.',
      );
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setPhotoUploading(true);
    try {
      const uploadMeta = await apiFetchData<{
        uploadUrl: string;
        imageUrl: string;
        storageKey: string;
        uploadToken: string;
      }>('/businesses/me/photo/upload-url', {
        method: 'POST',
        json: { contentType },
      });

      const putResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': contentType,
          'x-upload-token': uploadMeta.uploadToken,
        },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error('Direct upload failed');
      }

      await apiFetchData('/businesses/me/photo', {
        method: 'POST',
        json: {
          imageUrl: uploadMeta.imageUrl.startsWith('http')
            ? uploadMeta.imageUrl
            : `${API_BASE}${uploadMeta.imageUrl}`,
          storageKey: uploadMeta.storageKey,
        },
      });

      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    } catch (err) {
      setPhotoError(getApiErrorMessage(err));
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  }

  async function handleRemovePhoto() {
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      await apiFetchData('/businesses/me/photo', { method: 'DELETE' });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    } catch (err) {
      setPhotoError(getApiErrorMessage(err));
    } finally {
      setPhotoUploading(false);
    }
  }

  const onboardingStatus = profileQuery.data?.onboardingStatus ?? 'in_progress';
  const directoryVisible = stylistProfileQuery.data?.directoryVisible ?? false;
  const stylistId = stylistProfileQuery.data?.id;
  const photoUrl = stylistProfileQuery.data?.photoUrl ?? null;
  const displayName = businessName || stylistProfileQuery.data?.businessName || 'You';
  const escalatedCount = escalatedQuery.data?.items.length ?? 0;
  const showDevSimulator = process.env.NODE_ENV !== 'production' && smsNumber;

  return (
    <PageShell>
      <PageHeader
        title="Profile"
        subtitle="Business details and SMS testing tools for local dev."
      />

      <div className="mt-6 space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <StylistAvatar photoUrl={photoUrl} name={displayName} size="lg" />
            <div className="min-w-0">
              <h2 className="font-medium text-ink">Profile photo</h2>
              <p className="text-sm text-ink-muted">
                Clients see this on your directory listing and booking page.
              </p>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">
              {photoUrl ? 'Replace photo' : 'Upload photo'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => void handlePhotoChange(e)}
              disabled={photoUploading}
            />
          </label>
          {photoUrl ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void handleRemovePhoto()}
              disabled={photoUploading}
            >
              Remove photo
            </Button>
          ) : null}
          {photoError ? <p className="text-sm text-error">{photoError}</p> : null}
          {photoUploading ? <p className="text-sm text-ink-muted">Updating photo…</p> : null}
        </Card>

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
                hint="Neighborhood clients see before booking (e.g. Peckham)"
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Where can clients book?</legend>
                <p className="text-xs text-ink-muted">
                  Tick every option you offer. Clients choose one when they book.
                </p>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={offersStylistLocation}
                    onChange={(e) => setOffersStylistLocation(e.target.checked)}
                  />
                  Clients come to my workplace
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={offersComeToClient}
                    onChange={(e) => setOffersComeToClient(e.target.checked)}
                  />
                  I come to the client (home visit)
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={offersRemote}
                    onChange={(e) => setOffersRemote(e.target.checked)}
                  />
                  Remote / online
                </label>
              </fieldset>
              {offersStylistLocation ? (
                <Textarea
                  label="Workplace address"
                  value={workplaceAddress}
                  onChange={(e) => setWorkplaceAddress(e.target.value)}
                  placeholder="Studio or salon address clients will travel to"
                  required
                />
              ) : null}
              {offersComeToClient ? (
                <Input
                  label="Home visit surcharge (£)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={homeVisitSurcharge}
                  onChange={(e) => setHomeVisitSurcharge(e.target.value)}
                  hint="Added only when the client chooses a home visit"
                />
              ) : null}
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

        <Card className="space-y-4">
          <div>
            <h2 className="font-medium text-ink">Beta directory listing</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Opt in to appear on Find a braider. You need a business name, location area, and at
              least one active service.
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-primary"
              checked={directoryVisible}
              disabled={directoryMutation.isPending || stylistProfileQuery.isLoading}
              onChange={(event) => void handleDirectoryToggle(event.target.checked)}
            />
            <span className="text-sm text-ink">List my profile in the beta directory</span>
          </label>
          {directoryError ? <p className="text-sm text-error">{directoryError}</p> : null}
          {directoryVisible && stylistId ? (
            <Link href={`/directory/${stylistId}`} className={TOUCH_LINK_CLASS}>
              Preview your public listing →
            </Link>
          ) : null}
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

        {showDevSimulator ? (
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
