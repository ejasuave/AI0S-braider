'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ResolveServiceShareResponse } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';
import { serviceBookingPath, stylistBookingPath } from '@/shared/lib/booking-links';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

/**
 * Vanity share path → redirect to UUID booking flow.
 * `/stylist/{stylistSlug}/{styleSlug}/{sizeSlug}/{lengthSlug}`
 */
export default function StylistVanitySharePage() {
  const params = useParams<{ stylistSlug: string; segments?: string[] }>();
  const router = useRouter();
  const stylistSlug = params.stylistSlug;
  const segments = params.segments ?? [];

  const styleSlug = segments[0];
  const sizeSlug = segments[1];
  const lengthSlug = segments[2];
  const canResolve = Boolean(stylistSlug && styleSlug && sizeSlug && lengthSlug);

  const resolveQuery = useQuery({
    queryKey: ['resolve-share', stylistSlug, styleSlug, sizeSlug, lengthSlug],
    queryFn: () =>
      apiFetchData<ResolveServiceShareResponse>(
        `/profile/stylists/by-slug/${stylistSlug}/services/${styleSlug}/${sizeSlug}/${lengthSlug}`,
        { auth: false },
      ),
    enabled: canResolve,
    retry: false,
  });

  const bookingPageQuery = useQuery({
    queryKey: ['booking-page-by-slug', stylistSlug],
    queryFn: () =>
      apiFetchData<{ stylistId: string }>(
        `/profile/stylists/by-slug/${stylistSlug}/booking-page`,
        { auth: false },
      ),
    enabled: Boolean(stylistSlug) && !canResolve,
    retry: false,
  });

  useEffect(() => {
    if (resolveQuery.data) {
      router.replace(
        serviceBookingPath(resolveQuery.data.stylistId, resolveQuery.data.serviceOfferingId),
      );
    }
  }, [resolveQuery.data, router]);

  useEffect(() => {
    if (bookingPageQuery.data?.stylistId) {
      router.replace(stylistBookingPath(bookingPageQuery.data.stylistId));
    }
  }, [bookingPageQuery.data, router]);

  const failed = resolveQuery.isError || bookingPageQuery.isError;

  return (
    <PageShell>
      <PageHeader title="Opening booking…" subtitle="Taking you to the booking page." />
      <Card className="mt-6 space-y-2">
        {failed ? (
          <p className="text-sm text-error">
            We couldn&apos;t find that booking link. Ask your stylist for an updated link.
          </p>
        ) : (
          <p className="text-sm text-ink-muted">Loading…</p>
        )}
      </Card>
    </PageShell>
  );
}
