'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { DirectoryStylistDetail } from '@project-braids/shared-types/api';
import { apiFetchData } from '@/shared/lib/api-client';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

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

  return (
    <PageShell>
      <PageHeader title="Stylist profile" backHref="/directory" />

      {detailQuery.isLoading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : stylist ? (
        <div className="mt-6 space-y-4">
          <Card className="space-y-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">
                {stylist.businessName}
              </h1>
              <p className="text-sm text-ink-muted">{stylist.locationArea}</p>
            </div>
            {stylist.bio ? <p className="text-sm text-ink">{stylist.bio}</p> : null}
            <p className="text-xs text-ink-muted">
              Prices shown are starting points — your stylist confirms the final quote when you
              book.
            </p>
          </Card>

          <div className="space-y-3">
            <h2 className="font-medium text-ink">Services</h2>
            {stylist.offerings.map((offering) => (
              <Card key={offering.id} className="space-y-3">
                <div>
                  <h3 className="font-medium text-ink">{offering.styleName}</h3>
                  <p className="text-sm text-ink-muted">
                    {formatMoney(offering.basePrice)} · {offering.estimatedDurationMinutes} min
                  </p>
                </div>
                <Link
                  href={`/book?stylistId=${stylist.stylistId}&serviceOfferingId=${offering.id}`}
                >
                  <Button fullWidth>Book this style</Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="mt-6">
          <p className="text-sm text-error">This stylist is not listed in the directory.</p>
        </Card>
      )}
    </PageShell>
  );
}
