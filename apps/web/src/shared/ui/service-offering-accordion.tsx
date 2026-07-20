'use client';

import Link from 'next/link';
import type { PublicPortfolioImage } from '@project-braids/shared-types/api';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { PortfolioGallery } from '@/shared/ui/portfolio-gallery';

export type ServiceAccordionItem = {
  id: string;
  styleName: string;
  basePrice: string;
  estimatedDurationMinutes: number;
  sizeTier?: string | null;
  lengthTier?: string | null;
  parentCategoryName?: string | null;
  portfolio?: PublicPortfolioImage[];
  /** Optional short line shown when expanded (tiers, custom note, etc.). */
  description?: string | null;
};

/**
 * Native exclusive accordion (`details[name]`) — one open panel at a time,
 * keyboard accessible, no extra UI library.
 */
export function ServiceOfferingAccordion({
  stylistId,
  items,
  bookHref,
}: {
  stylistId: string;
  items: ServiceAccordionItem[];
  bookHref: (stylistId: string, serviceOfferingId: string) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">No services listed yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((offering) => (
        <details
          key={offering.id}
          name={`stylist-services-${stylistId}`}
          className="group overflow-hidden rounded-lg border border-border bg-surface open:shadow-sm"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="font-medium text-ink">{offering.styleName}</span>
            <span
              aria-hidden
              className="shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
            >
              ▾
            </span>
          </summary>

          <div className="border-t border-border px-4 pb-4 pt-3 transition-[grid-template-rows,opacity] duration-200 ease-out">
            {offering.description ? (
              <p className="text-sm text-ink-muted">{offering.description}</p>
            ) : null}
            <p className={`text-sm text-ink ${offering.description ? 'mt-2' : ''}`}>
              {formatMoney(offering.basePrice)} · {offering.estimatedDurationMinutes} min
            </p>

            {(offering.portfolio?.length ?? 0) > 0 ? (
              <div className="mt-4">
                <PortfolioGallery items={offering.portfolio ?? []} />
              </div>
            ) : null}

            <div className="mt-8">
              <Link href={bookHref(stylistId, offering.id)}>
                <Button fullWidth>Book this style</Button>
              </Link>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
