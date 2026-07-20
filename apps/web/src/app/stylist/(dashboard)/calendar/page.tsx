'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type {
  CalendarConflict,
  CalendarConnectionStatus,
  CalendarConflictResolution,
  SchedulingSettings,
} from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { getWebEnv } from '@/env';
import { formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import { StatusBadge } from '@/shared/ui/status-badge';

const WEB_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
const OAUTH_CODE_STORAGE_KEY = 'stylist-calendar-oauth-code';

function CalendarSettingsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState('15');

  const statusQuery = useQuery({
    queryKey: ['business', 'calendar', 'status'],
    queryFn: () => apiFetchData<CalendarConnectionStatus>('/businesses/me/calendar/status'),
  });

  const schedulingQuery = useQuery({
    queryKey: ['business', 'scheduling'],
    queryFn: () => apiFetchData<SchedulingSettings>('/businesses/me/scheduling'),
  });

  const conflictsQuery = useQuery({
    queryKey: ['business', 'calendar-conflicts'],
    queryFn: () => apiFetchData<CalendarConflict[]>('/businesses/me/calendar-conflicts'),
  });

  useEffect(() => {
    if (schedulingQuery.data) {
      setBufferMinutes(String(schedulingQuery.data.bufferMinutes));
    }
  }, [schedulingQuery.data]);

  const connectMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetchData<{ connected: true }>('/businesses/me/calendar/google/connect', {
        method: 'POST',
        json: {
          code,
          redirectUri: `${WEB_ORIGIN}/stylist/calendar`,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'calendar', 'status'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetchData<{ disconnected: true }>('/businesses/me/calendar/google', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'calendar', 'status'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: CalendarConflictResolution;
    }) =>
      apiFetchData<CalendarConflict>(`/businesses/me/calendar-conflicts/${conflictId}/resolve`, {
        method: 'POST',
        json: { resolution },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', 'calendar-conflicts'] });
    },
  });

  const saveBufferMutation = useMutation({
    mutationFn: () =>
      apiFetchData<SchedulingSettings>('/businesses/me/scheduling', {
        method: 'PATCH',
        json: { bufferMinutes: Number(bufferMinutes) },
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'scheduling'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      return;
    }

    // Strip the code from the URL immediately so refresh/remount cannot retry exchange.
    window.history.replaceState({}, '', '/stylist/calendar');

    const lastHandled = sessionStorage.getItem(OAUTH_CODE_STORAGE_KEY);
    if (lastHandled === code) {
      return;
    }
    sessionStorage.setItem(OAUTH_CODE_STORAGE_KEY, code);

    let cancelled = false;

    void (async () => {
      setError(null);
      try {
        await connectMutation.mutateAsync(code);
      } catch (err) {
        if (cancelled) {
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ['business', 'calendar', 'status'] });
        const status = await queryClient.fetchQuery({
          queryKey: ['business', 'calendar', 'status'],
          queryFn: () => apiFetchData<CalendarConnectionStatus>('/businesses/me/calendar/status'),
        });
        if (!status.connected) {
          setError(getApiErrorMessage(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // OAuth callback: run when code appears in the URL (intentionally omit unstable deps).
  }, [searchParams]);

  async function handleConnect() {
    setError(null);
    const clientId = getWebEnv().NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      try {
        await connectMutation.mutateAsync('mock-calendar-code');
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
      return;
    }

    const redirectUri = `${WEB_ORIGIN}/stylist/calendar`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await disconnectMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleSaveBuffer(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await saveBufferMutation.mutateAsync();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const connected = statusQuery.data?.connected ?? false;
  const mockMode = statusQuery.data?.mockMode ?? false;
  const googleClientConfigured = Boolean(getWebEnv().NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const conflicts = conflictsQuery.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        subtitle="Google Calendar sync, buffer time, and external conflicts."
      />

      <div className="mt-6 space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-ink">Google Calendar</h2>
              <p className="text-sm text-ink-muted">
                Confirmed bookings sync to your calendar. External events are flagged, not silently
                blocked.
              </p>
            </div>
            <StatusBadge
              label={
                connected ? (mockMode ? 'Connected (dev mock)' : 'Connected') : 'Not connected'
              }
              tone={connected ? (mockMode ? 'warning' : 'success') : 'neutral'}
            />
          </div>

          {mockMode ? (
            <p className="text-sm text-warning">
              API is in mock calendar mode. Set <code className="text-xs">GOOGLE_CLIENT_ID</code>{' '}
              and <code className="text-xs">GOOGLE_CLIENT_SECRET</code> in the repo root{' '}
              <code className="text-xs">.env</code>, plus{' '}
              <code className="text-xs">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>, then restart{' '}
              <code className="text-xs">pnpm dev</code> and reconnect.
            </p>
          ) : null}

          {!mockMode && !googleClientConfigured ? (
            <p className="text-sm text-ink-muted">
              Set <code className="text-xs">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to start real Google
              OAuth from this page.
            </p>
          ) : null}

          {statusQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Checking connection…</p>
          ) : connected ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">
                Calendar: {statusQuery.data?.calendarId ?? 'primary'}
              </p>
              {statusQuery.data?.subscriptionExpiresAt ? (
                <p className="text-sm text-ink-muted">
                  Webhook renews before {formatDateTime(statusQuery.data.subscriptionExpiresAt)}
                </p>
              ) : !mockMode ? (
                <p className="text-sm text-ink-muted">
                  Push webhooks not active (common on localhost). Confirmed bookings still sync
                  outbound; inbound changes are picked up by the reconcile job.
                </p>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => void handleDisconnect()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect Google Calendar'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => void handleConnect()} disabled={connectMutation.isPending}>
              {connectMutation.isPending
                ? 'Connecting…'
                : googleClientConfigured
                  ? 'Connect Google Calendar'
                  : 'Connect (dev mock)'}
            </Button>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="font-medium text-ink">Buffer between appointments</h2>
          <p className="text-sm text-ink-muted">
            Extra time padded around existing bookings when showing availability to clients.
          </p>
          {schedulingQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : (
            <form className="space-y-3" onSubmit={handleSaveBuffer}>
              <Input
                label="Buffer (minutes)"
                type="number"
                min="0"
                max="240"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                required
              />
              {saved ? <p className="text-sm text-success">Buffer saved.</p> : null}
              <Button type="submit" fullWidth disabled={saveBufferMutation.isPending}>
                {saveBufferMutation.isPending ? 'Saving…' : 'Save buffer'}
              </Button>
            </form>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-medium text-ink">Calendar conflicts</h2>
          <p className="text-sm text-ink-muted">
            Events in Google Calendar that are not platform bookings and may overlap your schedule.
          </p>
          {conflictsQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading conflicts…</p>
          ) : conflicts.length === 0 ? (
            <p className="text-sm text-ink-muted">No unresolved conflicts.</p>
          ) : (
            <ul className="space-y-2">
              {conflicts
                .filter((conflict) => !conflict.resolvedAt)
                .map((conflict) => (
                  <li
                    key={conflict.id}
                    className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm space-y-2"
                  >
                    <p className="font-medium text-ink">
                      External event {conflict.externalEventId}
                    </p>
                    <p className="text-ink-muted">Detected {formatDateTime(conflict.detectedAt)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void resolveMutation.mutateAsync({
                            conflictId: conflict.id,
                            resolution: 'kept_platform_booking',
                          })
                        }
                        disabled={resolveMutation.isPending}
                      >
                        Keep platform booking
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void resolveMutation.mutateAsync({
                            conflictId: conflict.id,
                            resolution: 'kept_external_event',
                          })
                        }
                        disabled={resolveMutation.isPending}
                      >
                        Keep external event
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        {error ? <p className="text-sm text-error">{error}</p> : null}
      </div>
    </PageShell>
  );
}

export default function StylistCalendarPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-sm text-ink-muted">Loading calendar settings…</p>
        </PageShell>
      }
    >
      <CalendarSettingsContent />
    </Suspense>
  );
}
