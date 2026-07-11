'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Booking, ServiceOffering } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

type ManualBookingFormProps = {
  onCreated?: () => void;
};

export function ManualBookingForm({ onCreated }: ManualBookingFormProps) {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('90');
  const [serviceOfferingId, setServiceOfferingId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['business', 'services'],
    queryFn: () => apiFetchData<ServiceOffering[]>('/businesses/me/services'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const isoStart = new Date(startTime).toISOString();
      const payload: Record<string, unknown> = { startTime: isoStart };
      if (serviceOfferingId) {
        payload.serviceOfferingId = serviceOfferingId;
      } else {
        payload.durationMinutes = Number(durationMinutes);
      }
      return apiFetchData<Booking>('/bookings/manual', {
        method: 'POST',
        json: payload,
      });
    },
    onSuccess: () => {
      setError(null);
      setStartTime('');
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onCreated?.();
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!startTime) {
      setError('Choose a start time.');
      return;
    }
    try {
      await createMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-medium text-ink">Block time manually</p>
        <p className="text-xs text-ink-muted">
          Walk-ins and off-platform appointments go straight to confirmed — no deposit hold.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="text-ink-muted">Start</span>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-ink-muted">Service (optional)</span>
          <select
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={serviceOfferingId}
            onChange={(event) => setServiceOfferingId(event.target.value)}
          >
            <option value="">Calendar block only</option>
            {(servicesQuery.data ?? []).map((service) => (
              <option key={service.id} value={service.id}>
                {service.styleName}
              </option>
            ))}
          </select>
        </label>

        {!serviceOfferingId ? (
          <label className="block space-y-1 text-sm">
            <span className="text-ink-muted">Duration (minutes)</span>
            <Input
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              required
            />
          </label>
        ) : null}

        {error ? <p className="text-sm text-error">{error}</p> : null}

        <Button type="submit" fullWidth disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Saving…' : 'Add to calendar'}
        </Button>
      </form>
    </Card>
  );
}
