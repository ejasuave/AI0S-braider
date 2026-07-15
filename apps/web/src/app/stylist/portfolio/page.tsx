'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { PortfolioItem, ServiceOffering } from '@project-braids/shared-types/api';
import { ServicePortfolioManager } from '@/features/stylist/service-portfolio-manager';
import { apiFetchData } from '@/shared/lib/api-client';
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
        subtitle="Add photos per service, plus general other work clients can browse."
      />
      <div className="mt-6 space-y-4">
        <Card className="space-y-3">
          <p className="text-sm text-ink-muted">
            Each service can have up to 10 JPEG, PNG, or WebP images (5 MB each). Use Other work for
            photos that aren’t tied to one style.
          </p>
          <Link href="/stylist/services">
            <Button variant="secondary" fullWidth>
              Manage services
            </Button>
          </Link>
        </Card>

        {servicesQuery.isLoading || portfolioQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : services.length === 0 ? (
          <EmptyState
            title="Add a service first"
            description="Service galleries live on each style you offer. You can still add Other work below once you’re set up — or add a service to attach style-specific photos."
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

        <Card className="space-y-2">
          <div>
            <h2 className="font-medium text-ink">Other work</h2>
            <p className="text-sm text-ink-muted">
              General photos not linked to a single service. Shown separately on your public
              profile.
            </p>
          </div>
          <ServicePortfolioManager
            serviceId={null}
            serviceName="Other work"
            items={uncategorized}
          />
        </Card>
      </div>
    </PageShell>
  );
}
