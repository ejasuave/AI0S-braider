'use client';

import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

/** Ch.10 reviews UI home — backend exists; full list UI deferred. */
export default function StylistReviewsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Reviews"
        subtitle="Client feedback after completed appointments."
        backHref="/stylist/more"
      />

      <Card className="mt-6 space-y-2">
        <p className="text-sm font-medium text-ink">Coming soon</p>
        <p className="text-sm text-ink-muted">
          Review requests and ratings are sent automatically after appointments (Chapter 10). A full
          reviews inbox will land in a later prompt.
        </p>
      </Card>
    </PageShell>
  );
}
