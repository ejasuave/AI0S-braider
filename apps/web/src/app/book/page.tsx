'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type {
  Booking,
  BusinessAvailabilityResponse,
  PublicBookingPage,
  ServiceVenueMode,
} from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { serviceBookingPath, stylistBookingPath } from '@/shared/lib/booking-links';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { serviceVenueModeLabel } from '@/shared/lib/venue';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { PortfolioGallery, StylistAvatar } from '@/shared/ui/portfolio-gallery';
import { StatusBadge } from '@/shared/ui/status-badge';

function useBookingPage(stylistId: string) {
  return useQuery({
    queryKey: ['booking-page', stylistId],
    queryFn: () =>
      apiFetchData<PublicBookingPage>(`/profile/stylists/${stylistId}/booking-page`, {
        auth: false,
      }),
    enabled: Boolean(stylistId),
  });
}

function ServicePicker({
  stylistId,
  page,
  isLoading,
  isError,
}: {
  stylistId: string;
  page: PublicBookingPage | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <PageShell>
      <PageHeader
        title={page?.businessName ?? 'Book appointment'}
        subtitle={page?.locationArea ?? 'Choose a service to continue'}
      />

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading services…</p>
        ) : isError || !page ? (
          <Card>
            <p className="text-sm text-error">Could not load this stylist&apos;s booking page.</p>
          </Card>
        ) : page.offerings.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">No services available to book right now.</p>
          </Card>
        ) : (
          <>
            <Card className="flex items-center gap-3">
              <StylistAvatar photoUrl={page.photoUrl} name={page.businessName} size="md" />
              <div className="min-w-0">
                <p className="font-medium text-ink">{page.businessName}</p>
                {page.locationArea ? (
                  <p className="text-sm text-ink-muted">{page.locationArea}</p>
                ) : null}
              </div>
            </Card>
            <p className="text-sm text-ink-muted">
              Select a style to see available times and hold your slot.
              {(page?.venueOptions?.length ?? 0) > 0
                ? ` Options: ${page!.venueOptions.map(serviceVenueModeLabel).join(', ')}.`
                : ''}
            </p>
            <div className="space-y-3">
              {page.offerings.map((offering) => (
                <Card key={offering.id} className="space-y-3">
                  <div>
                    <h2 className="font-medium text-ink">{offering.styleName}</h2>
                    <p className="text-sm text-ink-muted">
                      {formatMoney(offering.basePrice)} · {offering.estimatedDurationMinutes} min
                    </p>
                  </div>
                  {(offering.portfolio?.length ?? 0) > 0 ? (
                    <PortfolioGallery items={offering.portfolio ?? []} />
                  ) : null}
                  <Link href={serviceBookingPath(stylistId, offering.id)}>
                    <Button fullWidth>Book this style</Button>
                  </Link>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function ServiceBooking({
  stylistId,
  serviceOfferingId,
}: {
  stylistId: string;
  serviceOfferingId: string;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState('');
  const [clientVisitAddress, setClientVisitAddress] = useState('');
  const [chosenVenueMode, setChosenVenueMode] = useState<ServiceVenueMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageQuery = useBookingPage(stylistId);
  const offering = pageQuery.data?.offerings.find((o) => o.id === serviceOfferingId);
  const businessId = pageQuery.data?.businessId ?? '';
  const venueOptions = pageQuery.data?.venueOptions ?? [];
  const homeVisitSurcharge = pageQuery.data?.homeVisitSurcharge;

  useEffect(() => {
    if (venueOptions.length === 1) {
      setChosenVenueMode(venueOptions[0]!);
    } else if (chosenVenueMode && !venueOptions.includes(chosenVenueMode)) {
      setChosenVenueMode(null);
    }
  }, [venueOptions, chosenVenueMode]);

  const venueMode = chosenVenueMode;

  const availabilityQuery = useQuery({
    queryKey: ['availability', businessId, serviceOfferingId],
    queryFn: () =>
      apiFetchData<BusinessAvailabilityResponse>(
        `/businesses/${businessId}/availability?serviceOfferingId=${serviceOfferingId}&limit=12`,
        { auth: false },
      ),
    enabled: Boolean(businessId && serviceOfferingId),
  });

  const holdMutation = useMutation({
    mutationFn: (startTime: string) =>
      apiFetchData<Booking>('/bookings/holds', {
        method: 'POST',
        json: {
          stylistId,
          serviceOfferingId,
          startTime,
          source: 'client_direct',
          clientDisplayName: clientDisplayName.trim() || undefined,
          serviceVenueMode: venueMode ?? undefined,
          clientVisitAddress:
            venueMode === 'come_to_client' ? clientVisitAddress.trim() : undefined,
        },
      }),
  });

  const bookPath = serviceBookingPath(stylistId, serviceOfferingId);
  const authNext = encodeURIComponent(bookPath);

  async function handleBook() {
    if (!selectedSlot) return;
    setError(null);

    if (!auth.isClient) {
      router.push(`/login/client?next=${authNext}`);
      return;
    }

    if (!clientDisplayName.trim()) {
      setError('Enter your name so your stylist knows who is arriving.');
      return;
    }

    if (!venueMode) {
      setError('Choose where you want the appointment.');
      return;
    }

    if (venueMode === 'come_to_client' && clientVisitAddress.trim().length < 5) {
      setError('Enter the address for your home visit.');
      return;
    }

    try {
      const booking = await holdMutation.mutateAsync(selectedSlot);
      router.push(`/client/bookings/${booking.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const serviceTotal =
    offering && venueMode === 'come_to_client' && homeVisitSurcharge
      ? Number(offering.basePrice) + Number(homeVisitSurcharge)
      : offering
        ? Number(offering.basePrice)
        : null;

  return (
    <PageShell>
      <PageHeader
        title={pageQuery.data?.businessName ?? 'Book appointment'}
        subtitle={pageQuery.data?.locationArea ?? undefined}
        backHref={stylistBookingPath(stylistId)}
      />

      <div className="mt-6 space-y-4">
        {pageQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : offering ? (
          <Card className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-ink">{offering.styleName}</h2>
            <p className="text-sm text-ink-muted">
              {formatMoney(offering.basePrice)} · {offering.estimatedDurationMinutes} minutes
            </p>
            {serviceTotal != null && venueMode === 'come_to_client' && Number(homeVisitSurcharge) > 0 ? (
              <p className="text-sm text-ink">
                Estimated total with home visit: {formatMoney(serviceTotal.toFixed(2))}
              </p>
            ) : null}
            <StatusBadge label="AI receptionist available via SMS" tone="ai" />
          </Card>
        ) : (
          <Card className="space-y-3">
            <p className="text-sm text-error">Service not found or inactive.</p>
            <Link href={stylistBookingPath(stylistId)}>
              <Button variant="secondary" fullWidth>
                Choose another service
              </Button>
            </Link>
          </Card>
        )}

        {!auth.isAuthenticated ? (
          <Card className="space-y-3 border-primary/20 bg-primary-subtle">
            <p className="text-sm text-ink">
              Browse available times below, then sign in to hold a slot.
            </p>
            <div className="flex gap-2">
              <Link href={`/login/client?next=${authNext}`} className="flex-1">
                <Button variant="secondary" fullWidth>
                  Client sign in
                </Button>
              </Link>
              <Link href={`/register/client?next=${authNext}`} className="flex-1">
                <Button fullWidth>Create account</Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {offering ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Available times
            </h3>
            {availabilityQuery.isLoading ? (
              <p className="text-sm text-ink-muted">Finding slots…</p>
            ) : (availabilityQuery.data?.slots.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-muted">No slots available right now.</p>
            ) : (
              <div className="grid gap-2">
                {availabilityQuery.data!.slots.map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() => setSelectedSlot(slot.startTime)}
                    disabled={!auth.isClient}
                    className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                      selectedSlot === slot.startTime
                        ? 'border-primary bg-primary-subtle text-ink'
                        : 'border-border bg-surface hover:bg-surface-raised'
                    }`}
                  >
                    {formatDateTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {auth.isClient && offering ? (
          <>
            <Card className="space-y-3">
              <Input
                label="Your name"
                value={clientDisplayName}
                onChange={(e) => setClientDisplayName(e.target.value)}
                placeholder="How the stylist should address you"
                required
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Where should this be?</legend>
                {venueOptions.map((mode) => (
                  <label key={mode} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="serviceVenueMode"
                      value={mode}
                      checked={venueMode === mode}
                      onChange={() => setChosenVenueMode(mode)}
                    />
                    {serviceVenueModeLabel(mode)}
                  </label>
                ))}
              </fieldset>
              {venueMode === 'come_to_client' ? (
                <>
                  {homeVisitSurcharge && Number(homeVisitSurcharge) > 0 ? (
                    <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink">
                      Home visit surcharge: {formatMoney(homeVisitSurcharge)} will be added to the
                      service price.
                    </p>
                  ) : null}
                  <Textarea
                    label="Visit address"
                    value={clientVisitAddress}
                    onChange={(e) => setClientVisitAddress(e.target.value)}
                    placeholder="Full address for your home visit"
                    required
                  />
                </>
              ) : null}
              {venueMode === 'stylist_location' ? (
                <p className="text-xs text-ink-muted">
                  The stylist&apos;s workplace address is shared after your booking is confirmed.
                </p>
              ) : null}
            </Card>

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <Button
              fullWidth
              disabled={!selectedSlot || holdMutation.isPending}
              onClick={handleBook}
            >
              {holdMutation.isPending ? 'Holding slot…' : 'Hold this slot'}
            </Button>
          </>
        ) : auth.isAuthenticated ? (
          <Card className="space-y-3 border-warning/30 bg-warning/5">
            <p className="text-sm text-ink">
              You&apos;re signed in as a stylist. Sign out and use a client account to book.
            </p>
            <SignOutButton redirectTo={`/login/client?next=${authNext}`} />
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}

function BookFlow() {
  const searchParams = useSearchParams();
  const stylistId = searchParams.get('stylistId') ?? '';
  const serviceOfferingId = searchParams.get('serviceOfferingId') ?? '';

  const pageQuery = useBookingPage(stylistId);

  if (!stylistId) {
    return (
      <PageShell>
        <PageHeader title="Book" subtitle="Use the link your stylist shared." />
        <Card className="mt-6">
          <p className="break-all text-sm text-ink-muted">
            This page needs a <code className="text-xs">stylistId</code> in the URL.
          </p>
        </Card>
      </PageShell>
    );
  }

  if (!serviceOfferingId) {
    return (
      <ServicePicker
        stylistId={stylistId}
        page={pageQuery.data}
        isLoading={pageQuery.isLoading}
        isError={pageQuery.isError}
      />
    );
  }

  return <ServiceBooking stylistId={stylistId} serviceOfferingId={serviceOfferingId} />;
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-sm text-ink-muted">Loading booking…</p>
        </PageShell>
      }
    >
      <BookFlow />
    </Suspense>
  );
}
