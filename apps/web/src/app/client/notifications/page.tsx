'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { NotificationPreferences } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function ClientNotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [appointmentRemindersEnabled, setAppointmentRemindersEnabled] = useState(true);
  const [marketingMessagesEnabled, setMarketingMessagesEnabled] = useState(true);

  const preferencesQuery = useQuery({
    queryKey: ['client', 'notification-preferences'],
    queryFn: () => apiFetchData<NotificationPreferences>('/clients/me/notification-preferences'),
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      setAppointmentRemindersEnabled(preferencesQuery.data.appointmentRemindersEnabled);
      setMarketingMessagesEnabled(preferencesQuery.data.marketingMessagesEnabled);
    }
  }, [preferencesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetchData<NotificationPreferences>('/clients/me/notification-preferences', {
        method: 'PATCH',
        json: {
          appointmentRemindersEnabled,
          marketingMessagesEnabled,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['client', 'notification-preferences'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Notification preferences"
        subtitle="Control reminders and marketing messages. Booking confirmations and cancellations always send."
      />

      <Card className="mt-6 space-y-4">
        {preferencesQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Loading preferences…</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={appointmentRemindersEnabled}
                onChange={(e) => setAppointmentRemindersEnabled(e.target.checked)}
              />
              <span>
                <span className="font-medium text-ink">Appointment reminders</span>
                <span className="mt-0.5 block text-ink-muted">
                  48-hour and 2-hour SMS reminders before your appointment.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={marketingMessagesEnabled}
                onChange={(e) => setMarketingMessagesEnabled(e.target.checked)}
              />
              <span>
                <span className="font-medium text-ink">Marketing messages</span>
                <span className="mt-0.5 block text-ink-muted">
                  Promotional updates from stylists. Does not affect booking confirmations.
                </span>
              </span>
            </label>

            <p className="text-xs text-ink-muted">
              Text STOP to any stylist number to pause the booking assistant. Text START to resume.
              Confirmations and reminders still apply per our compliance policy.
            </p>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {saved ? <p className="text-sm text-success">Saved</p> : null}

            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save preferences'}
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
