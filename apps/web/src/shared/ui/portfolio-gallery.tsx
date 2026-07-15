'use client';

import { useEffect, useState } from 'react';
import { resolveMediaUrl } from '@/shared/lib/media-url';

export type PortfolioGalleryItem = {
  id: string;
  imageUrl: string;
};

export function PortfolioGallery({
  items,
  emptyLabel = 'No work photos yet.',
}: {
  items: PortfolioGalleryItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const src = resolveMediaUrl(item.imageUrl);
        if (!src) return null;
        return (
          <img
            key={item.id}
            src={src}
            alt="Stylist work"
            className="aspect-square w-full rounded-md object-cover"
          />
        );
      })}
    </div>
  );
}

export function StylistAvatar({
  photoUrl,
  name,
  size = 'md',
}: {
  photoUrl: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const src = resolveMediaUrl(photoUrl ?? null);
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-12 w-12 text-sm' : 'h-14 w-14 text-lg';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name} profile`}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-surface-raised font-medium text-ink-muted`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
