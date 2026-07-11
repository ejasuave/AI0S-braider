'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type {
  AvailabilityResponse,
  Booking,
  PublicBookingPage,
} from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

function BookFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();

  const stylistId = searchParams.get('stylistId') ?? '';
  const serviceOfferingId = searchParams.get('serviceOfferingId') ?? '';
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageQuery = useQuery({
    queryKey: ['booking-page', stylistId],
    queryFn: () =>
      apiFetchData<PublicBookingPage>(`/profile/stylists/${stylistId}/booking-page`, {
        auth: false,
      }),
    enabled: Boolean(stylistId),
  });

  const offering = pageQuery.data?.offerings.find((o) => o.id === serviceOfferingId);

  const availabilityQuery = useQuery({
    queryKey: ['availability', stylistId, serviceOfferingId],
    queryFn: () =>
      apiFetchData<AvailabilityResponse>(
        `/bookings/availability?stylistId=${stylistId}&serviceOfferingId=${serviceOfferingId}&limit=12`,
      ),
    enabled: Boolean(stylistId && serviceOfferingId && auth.isClient),
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
        },
      }),
  });

  if (!stylistId || !serviceOfferingId) {
    return (
      <PageShell>
        <PageHeader title="Book" subtitle="Use the link your stylist shared." />
        <Card className="mt-6">
          <p className="break-all text-sm text-ink-muted">
            This page needs <code className="text-xs">stylistId</code> and{' '}
            <code className="text-xs">serviceOfferingId</code> in the URL.
          </p>
        </Card>
      </PageShell>
    );
  }

  const bookPath = `/book?stylistId=${stylistId}&serviceOfferingId=${serviceOfferingId}`;
  const authNext = encodeURIComponent(bookPath);

  async function handleBook() {
    if (!selectedSlot) return;
    setError(null);

    if (!auth.isClient) {
      router.push(`/login/client?next=${authNext}`);
      return;
    }

    try {
      const booking = await holdMutation.mutateAsync(selectedSlot);
      router.push(`/client/bookings/${booking.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={pageQuery.data?.businessName ?? 'Book appointment'}
        subtitle={pageQuery.data?.locationArea ?? undefined}
        backHref={`/directory/${stylistId}`}
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
            <StatusBadge label="AI receptionist available via SMS" tone="ai" />
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-error">Service not found or inactive.</p>
          </Card>
        )}

        {!auth.isAuthenticated ? (
          <Card className="space-y-3 bg-primary-subtle border-primary/20">
            <p className="text-sm text-ink">
              Sign in with your phone or create a client account to pick a time.
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
        ) : auth.isClient ? (
          <>
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
                      className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
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

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <Button
              fullWidth
              disabled={!selectedSlot || holdMutation.isPending}
              onClick={handleBook}
            >
              {holdMutation.isPending ? 'Holding slot…' : 'Hold this slot'}
            </Button>
          </>
        ) : (
          <Card className="space-y-3 bg-warning/5 border-warning/30">
            <p className="text-sm text-ink">
              You&apos;re signed in as a stylist. Sign out and use a client account to book.
            </p>
            <SignOutButton redirectTo={`/login/client?next=${authNext}`} />
          </Card>
        )}
      </div>
    </PageShell>
  );
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
