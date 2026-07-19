'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { DirectoryStylistDetail } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';
import { resolveMediaUrl } from '@/shared/lib/media-url';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StylistAvatar, PortfolioGallery } from '@/shared/ui/portfolio-gallery';
import { ServiceOfferingAccordion } from '@/shared/ui/service-offering-accordion';
import { SaveStylistButton } from '@/features/client/save-stylist-button';
import { TextSmsCta } from '@/features/messaging/text-sms-cta';
import { Button } from '@/shared/ui/button';
import Link from 'next/link';
import { stylistBookingPath } from '@/shared/lib/booking-links';

export default function DirectoryStylistPage() {
  const params = useParams<{ stylistId: string }>();

  const detailQuery = useQuery({
    queryKey: ['directory', 'stylist', params.stylistId],
    queryFn: () =>
      apiFetchData<DirectoryStylistDetail>(`/directory/stylists/${params.stylistId}`, {
        auth: false,
      }),
  });

  const stylist = detailQuery.data;
  const otherWork = (stylist?.portfolio ?? []).filter((item) => !item.serviceOfferingId);
  const heroUrl = stylist
    ? (resolveMediaUrl(stylist.photoUrl) ??
      resolveMediaUrl(stylist.portfolio?.[0]?.imageUrl ?? null))
    : null;

  return (
    <PageShell>
      <PageHeader title="Stylist profile" backHref="/directory" />

      {detailQuery.isLoading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : stylist ? (
        <div className="mt-6 space-y-4">
          <Card className="overflow-hidden p-0">
            {heroUrl ? (
              <img
                src={heroUrl}
                alt={`${stylist.businessName} profile`}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : null}
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <StylistAvatar photoUrl={stylist.photoUrl} name={stylist.businessName} size="lg" />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold text-ink">
                    {stylist.businessName}
                  </h1>
                  <p className="text-sm text-ink-muted">{stylist.locationArea}</p>
                </div>
              </div>
              {stylist.bio ? <p className="text-sm text-ink">{stylist.bio}</p> : null}
              <p className="text-xs text-ink-muted">
                Prices shown are starting points — your stylist confirms the final quote when you
                book.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={stylistBookingPath(stylist.stylistId)}>
                  <Button type="button" fullWidth>
                    Book appointment
                  </Button>
                </Link>
                <SaveStylistButton stylistId={stylist.stylistId} fullWidth />
              </div>
              <TextSmsCta
                smsBookingNumber={stylist.smsBookingNumber}
                stylistName={stylist.businessName}
              />
            </div>
          </Card>

          <div className="space-y-3">
            <h2 className="font-medium text-ink">Services</h2>
            <ServiceOfferingAccordion
              stylistId={stylist.stylistId}
              items={stylist.offerings}
              bookHref={(id, serviceId) => `/book?stylistId=${id}&serviceOfferingId=${serviceId}`}
            />
          </div>

          {otherWork.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-medium text-ink">Other work</h2>
              <PortfolioGallery items={otherWork} />
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="mt-6">
          <p className="text-sm text-error">This stylist is not listed in the directory.</p>
        </Card>
      )}
    </PageShell>
  );
}
