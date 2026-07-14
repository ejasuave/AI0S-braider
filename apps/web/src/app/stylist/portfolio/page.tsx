'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { PortfolioItem, ServiceOffering } from '@project-braids/shared-types/api';
import { ServicePortfolioManager } from '@/features/stylist/service-portfolio-manager';
import { apiFetchData } from '@/shared/lib/api-client';
import { resolveMediaUrl } from '@/shared/lib/media-url';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function StylistPortfolioPage() {
  const servicesQuery = useQuery({
    queryKey: ['business', 'services'],
    queryFn: () => apiFetchData<ServiceOffering[]>('/businesses/me/services'),
  });

  const portfolioQuery = useQuery({
    queryKey: ['business', 'portfolio'],
    queryFn: () => apiFetchData<PortfolioItem[]>('/businesses/me/portfolio'),
  });

  const services = servicesQuery.data ?? [];
  const uncategorized = (portfolioQuery.data ?? []).filter((item) => !item.serviceOfferingId);

  return (
    <PageShell>
      <PageHeader
        title="Portfolio"
        subtitle="Upload work photos on each service — clients see them under that style."
      />
      <div className="mt-6 space-y-4">
        <Card className="space-y-3">
          <p className="text-sm text-ink-muted">
            Predefined and custom services both support up to 10 JPEG, PNG, or WebP images (5 MB
            each). Manage everything here or from Services.
          </p>
          <Link href="/stylist/services">
            <Button variant="secondary" fullWidth>
              Go to services
            </Button>
          </Link>
        </Card>

        {servicesQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : services.length === 0 ? (
          <EmptyState
            title="Add a service first"
            description="Portfolio photos are linked to each service you offer."
          />
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="space-y-2">
                <div>
                  <h2 className="font-medium text-ink">{service.styleName}</h2>
                  <p className="text-sm text-ink-muted">
                    {service.isCustomStyle ? 'Custom service' : 'Catalog style'}
                    {service.active ? '' : ' · inactive'}
                  </p>
                </div>
                <ServicePortfolioManager
                  serviceId={service.id}
                  serviceName={service.styleName}
                  items={service.portfolio ?? []}
                />
              </Card>
            ))}
          </div>
        )}

        {uncategorized.length > 0 ? (
          <Card className="space-y-3">
            <div>
              <h2 className="font-medium text-ink">Other work</h2>
              <p className="text-sm text-ink-muted">
                Older or Instagram imports not linked to a service. Clients see these separately
                from service galleries.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {uncategorized.map((item) => {
                const src = resolveMediaUrl(item.imageUrl);
                return src ? (
                  <img
                    key={item.id}
                    src={src}
                    alt="Portfolio"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : null;
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
