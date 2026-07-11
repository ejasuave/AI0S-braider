'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { WorkingHourRow } from '@project-braids/shared-types/api';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayForm = { enabled: boolean; start: string; end: string };

const DEFAULT_DAYS: DayForm[] = [
  { enabled: false, start: '10:00', end: '16:00' },
  { enabled: true, start: '09:00', end: '18:00' },
  { enabled: true, start: '09:00', end: '18:00' },
  { enabled: true, start: '09:00', end: '18:00' },
  { enabled: true, start: '09:00', end: '18:00' },
  { enabled: true, start: '09:00', end: '18:00' },
  { enabled: true, start: '10:00', end: '16:00' },
];

export default function StylistHoursPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<DayForm[]>(DEFAULT_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hoursQuery = useQuery({
    queryKey: ['business', 'working-hours'],
    queryFn: () => apiFetchData<WorkingHourRow[]>('/businesses/me/working-hours'),
  });

  useEffect(() => {
    if (!hoursQuery.data?.length) return;
    const next = [...DEFAULT_DAYS];
    for (const row of hoursQuery.data) {
      if (row.isActive) {
        next[row.dayOfWeek] = { enabled: true, start: row.startTime, end: row.endTime };
      }
    }
    setDays(next);
  }, [hoursQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const hours = days.flatMap((day, dayOfWeek) =>
        day.enabled
          ? [{ dayOfWeek, startTime: day.start, endTime: day.end, isActive: true }]
          : [],
      );
      return apiFetchData<WorkingHourRow[]>('/businesses/me/working-hours', {
        method: 'PUT',
        json: { hours },
      });
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['business', 'working-hours'] });
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
      <PageHeader title="Working hours" subtitle="Your regular weekly schedule." />
      <Card className="mt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {days.map((day, index) => (
            <div key={DAY_LABELS[index]} className="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2">
              <span className="text-sm font-medium text-ink">{DAY_LABELS[index]}</span>
              <Input
                label="Start"
                type="time"
                value={day.start}
                onChange={(e) =>
                  setDays((prev) =>
                    prev.map((d, i) => (i === index ? { ...d, start: e.target.value } : d)),
                  )
                }
                disabled={!day.enabled}
              />
              <Input
                label="End"
                type="time"
                value={day.end}
                onChange={(e) =>
                  setDays((prev) =>
                    prev.map((d, i) => (i === index ? { ...d, end: e.target.value } : d)),
                  )
                }
                disabled={!day.enabled}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, i) => (i === index ? { ...d, enabled: e.target.checked } : d)),
                    )
                  }
                />
                Open
              </label>
            </div>
          ))}
          {error ? <p className="text-sm text-error">{error}</p> : null}
          {saved ? <p className="text-sm text-success">Hours saved.</p> : null}
          <Button type="submit" fullWidth disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save working hours'}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
