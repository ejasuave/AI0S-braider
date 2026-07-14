'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { DirectorySearchResponse } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatMoney } from '@/shared/lib/format';
import { resolveMediaUrl } from '@/shared/lib/media-url';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StylistAvatar } from '@/shared/ui/portfolio-gallery';

export default function DirectoryPage() {
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [style, setStyle] = useState('');
  const [submitted, setSubmitted] = useState({ q: '', location: '', style: '' });

  const searchQuery = useQuery({
    queryKey: ['directory', submitted],
    queryFn: () => {
      const params = new URLSearchParams();
      if (submitted.q) params.set('q', submitted.q);
      if (submitted.location) params.set('location', submitted.location);
      if (submitted.style) params.set('style', submitted.style);
      const query = params.toString();
      return apiFetchData<DirectorySearchResponse>(
        `/directory/stylists${query ? `?${query}` : ''}`,
        { auth: false },
      );
    },
  });

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted({ q: q.trim(), location: location.trim(), style: style.trim() });
  }

  const items = searchQuery.data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Find a braider"
        subtitle="Beta directory — stylists opt in. Prices confirmed at booking."
        backHref="/"
      />

      <div className="mt-6 space-y-4">
        <Card>
          <form className="space-y-3" onSubmit={handleSearch}>
            <Input
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, area, or style"
            />
            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Peckham, South London"
            />
            <Input
              label="Style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g. knotless braids"
            />
            <Button type="submit" fullWidth disabled={searchQuery.isFetching}>
              {searchQuery.isFetching ? 'Searching…' : 'Search'}
            </Button>
          </form>
        </Card>

        {searchQuery.isError ? (
          <Card className="border-error/30 bg-error/5">
            <p className="text-sm text-error">
              {getApiErrorMessage(
                searchQuery.error,
                'Could not load directory. Is the API running on port 3001?',
              )}
            </p>
          </Card>
        ) : searchQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading stylists…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No stylists found"
            description="Try a broader search, or ask your stylist for their booking link."
          />
        ) : (
          <div className="space-y-3">
            {items.map((listing) => (
              <Link
                key={listing.stylistId}
                href={`/directory/${listing.stylistId}`}
                className="block active:opacity-95"
              >
                <Card className="transition-shadow active:shadow-raised">
                  <div className="space-y-3">
                    {listing.coverImageUrl ? (
                      <img
                        src={resolveMediaUrl(listing.coverImageUrl) ?? undefined}
                        alt=""
                        className="aspect-[16/10] w-full rounded-md object-cover"
                      />
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <StylistAvatar
                          photoUrl={listing.photoUrl}
                          name={listing.businessName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <h2 className="font-display text-lg font-semibold text-ink">
                            {listing.businessName}
                          </h2>
                          <p className="text-sm text-ink-muted">{listing.locationArea}</p>
                        </div>
                      </div>
                      {listing.startingPrice ? (
                        <p className="shrink-0 text-sm font-medium text-ink">
                          from {formatMoney(listing.startingPrice)}
                        </p>
                      ) : null}
                    </div>
                    {listing.bio ? (
                      <p className="line-clamp-2 text-sm text-ink-muted">{listing.bio}</p>
                    ) : null}
                    <p className="text-xs text-ink-muted">
                      {listing.styleNames.slice(0, 4).join(' · ')}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
