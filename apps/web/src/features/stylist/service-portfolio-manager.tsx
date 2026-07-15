'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PortfolioItem } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { resolveMediaUrl } from '@/shared/lib/media-url';
import { Button } from '@/shared/ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_GALLERY = 10;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function normalizeContentType(type: string): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (type === 'image/jpg' || type === 'image/jpeg') return 'image/jpeg';
  if (type === 'image/png') return 'image/png';
  if (type === 'image/webp') return 'image/webp';
  return null;
}

export function ServicePortfolioManager({
  serviceId = null,
  serviceName,
  items,
}: {
  /** Null = general “Other work” gallery (not tied to a service). */
  serviceId?: string | null;
  serviceName: string;
  items: PortfolioItem[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const isOtherWork = !serviceId;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['business', 'services'] }),
      queryClient.invalidateQueries({ queryKey: ['business', 'portfolio'] }),
      queryClient.invalidateQueries({ queryKey: ['directory'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-page'] }),
    ]);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (items.length >= MAX_PER_GALLERY) {
      setError(`Maximum of ${MAX_PER_GALLERY} images for this gallery.`);
      event.target.value = '';
      return;
    }

    if (!ALLOWED_TYPES.has(file.type) && file.type !== '') {
      setError(
        'Use a JPEG, PNG, or WebP photo. iPhone HEIC photos need to be converted to JPEG first.',
      );
      event.target.value = '';
      return;
    }

    const contentType = normalizeContentType(file.type) ?? 'image/jpeg';
    if (file.type && !normalizeContentType(file.type)) {
      setError('Use a JPEG, PNG, or WebP photo from your gallery.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploadMeta = await apiFetchData<{
        uploadUrl: string;
        imageUrl: string;
        storageKey: string;
        uploadToken: string;
      }>('/businesses/me/portfolio/upload-url', {
        method: 'POST',
        json: {
          contentType,
          // Omit when null — older APIs rejected explicit null; new APIs treat omit as Other work.
          ...(serviceId ? { serviceOfferingId: serviceId } : {}),
        },
      });

      const putResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': contentType,
          'x-upload-token': uploadMeta.uploadToken,
        },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error('Direct upload failed');
      }

      await apiFetchData('/businesses/me/portfolio', {
        method: 'POST',
        json: {
          imageUrl: uploadMeta.imageUrl.startsWith('http')
            ? uploadMeta.imageUrl
            : `${API_BASE}${uploadMeta.imageUrl}`,
          storageKey: uploadMeta.storageKey,
          ...(serviceId ? { serviceOfferingId: serviceId } : {}),
        },
      });

      await invalidate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(itemId: string) {
    setError(null);
    setDeletingId(itemId);
    try {
      await apiFetchData(`/businesses/me/portfolio/${itemId}`, { method: 'DELETE' });
      await invalidate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div>
        <p className="text-sm font-medium text-ink">
          {isOtherWork ? 'Upload photos' : 'Work photos'}
        </p>
        <p className="text-xs text-ink-muted">
          {isOtherWork
            ? `General photos not tied to one service · ${items.length}/${MAX_PER_GALLERY}`
            : `Shown under ${serviceName} for clients · ${items.length}/${MAX_PER_GALLERY}`}
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Upload image for {serviceName}</span>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/*"
          className="block w-full text-sm"
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading || items.length >= MAX_PER_GALLERY}
        />
      </label>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {uploading ? <p className="text-sm text-ink-muted">Uploading…</p> : null}

      {items.length === 0 ? (
        isOtherWork ? null : (
          <p className="text-sm text-ink-muted">No photos for this service yet.</p>
        )
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => {
            const src = resolveMediaUrl(item.imageUrl);
            const failed = failedIds.has(item.id);

            if (isOtherWork && (!src || failed)) {
              // Nothing visible until a usable upload exists — only keep a remove control
              // for the stylist to clear stale rows.
              return (
                <div key={item.id} className="col-span-full">
                  <button
                    type="button"
                    className="text-xs text-ink-muted underline"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? 'Removing…' : 'Clear unavailable photo'}
                  </button>
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-2">
                {src && !failed ? (
                  <img
                    src={src}
                    alt={`${serviceName} portfolio`}
                    className="aspect-square w-full rounded-md object-cover"
                    onError={() =>
                      setFailedIds((prev) => {
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-md bg-surface-raised px-2 text-center text-xs text-ink-muted">
                    Image unavailable — remove and re-upload
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => void handleDelete(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
