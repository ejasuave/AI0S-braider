'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PortfolioItem } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function StylistPortfolioPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const portfolioQuery = useQuery({
    queryKey: ['business', 'portfolio'],
    queryFn: () => apiFetchData<PortfolioItem[]>('/businesses/me/portfolio'),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiFetchData(`/businesses/me/portfolio/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'portfolio'] });
    },
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const uploadMeta = await apiFetchData<{
        uploadUrl: string;
        imageUrl: string;
        storageKey: string;
        uploadToken: string;
      }>('/businesses/me/portfolio/upload-url', {
        method: 'POST',
        json: { contentType: file.type },
      });

      const putResponse = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': file.type,
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
        },
      });

      void queryClient.invalidateQueries({ queryKey: ['business', 'portfolio'] });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  const items = portfolioQuery.data ?? [];

  return (
    <PageShell>
      <PageHeader title="Portfolio" subtitle="Show your work — upload up to 50 images." />
      <div className="mt-6 space-y-4">
        <Card>
          <label className="block">
            <span className="text-sm font-medium text-ink">Add photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => void handleFileChange(e)}
              disabled={uploading}
            />
          </label>
          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
          {uploading ? <p className="mt-2 text-sm text-ink-muted">Uploading…</p> : null}
        </Card>

        {portfolioQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading portfolio…</p>
        ) : items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">No portfolio images yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="space-y-2 p-2">
                <img
                  src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE}${item.imageUrl}`}
                  alt="Portfolio"
                  className="aspect-square w-full rounded-md object-cover"
                />
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  Remove
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
