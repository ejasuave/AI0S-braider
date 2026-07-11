'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ServiceOffering } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell, SectionTitle } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';
import { EmptyState } from '@/shared/ui/empty-state';

export default function StylistServicesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [duration, setDuration] = useState('120');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function bookingUrl(service: ServiceOffering): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${origin}/book?stylistId=${service.stylistId}&serviceOfferingId=${service.id}`;
  }

  async function copyBookingLink(service: ServiceOffering) {
    const url = bookingUrl(service);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(service.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const servicesQuery = useQuery({
    queryKey: ['profile', 'services'],
    queryFn: () => apiFetchData<ServiceOffering[]>('/profile/services'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetchData<ServiceOffering>('/profile/services', {
        method: 'POST',
        json: {
          styleName,
          basePrice: Number(basePrice),
          estimatedDurationMinutes: Number(duration),
        },
      }),
    onSuccess: () => {
      setShowForm(false);
      setStyleName('');
      setBasePrice('');
      setDuration('120');
      void queryClient.invalidateQueries({ queryKey: ['profile', 'services'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetchData<ServiceOffering>(`/profile/services/${id}`, {
        method: 'PATCH',
        json: { active },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', 'services'] });
    },
  });

  const services = servicesQuery.data ?? [];

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createMutation.mutateAsync();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Services"
        subtitle="Set your styles and prices — clients book via your link."
      />

      <div className="mt-6 space-y-4">
        <Button fullWidth onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add service'}
        </Button>

        {showForm ? (
          <Card>
            <form className="space-y-4" onSubmit={handleCreate}>
              <SectionTitle>New service</SectionTitle>
              <Input
                label="Style name"
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                required
              />
              <Input
                label="Base price (£)"
                type="number"
                min="1"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
              />
              <Input
                label="Duration (minutes)"
                type="number"
                min="30"
                step="15"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
              {formError ? <p className="text-sm text-error">{formError}</p> : null}
              <Button type="submit" fullWidth disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving…' : 'Save service'}
              </Button>
            </form>
          </Card>
        ) : null}

        {servicesQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading services…</p>
        ) : services.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Add your first style so clients can book and pay a deposit."
          />
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-ink">{service.styleName}</h3>
                    <p className="text-sm text-ink-muted">
                      {formatMoney(service.basePrice)} · {service.estimatedDurationMinutes} min
                    </p>
                  </div>
                  <StatusBadge
                    label={service.active ? 'Active' : 'Inactive'}
                    tone={service.active ? 'success' : 'neutral'}
                  />
                </div>
                <p className="break-all text-xs text-ink-muted">{bookingUrl(service)}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => void copyBookingLink(service)}
                  >
                    {copiedId === service.id ? 'Copied!' : 'Copy link'}
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      toggleMutation.mutate({ id: service.id, active: !service.active })
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {service.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
