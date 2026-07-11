'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';
import type { BusinessStaff } from '@project-braids/shared-types/api';

type AuthMe = {
  businessId: string | null;
};

async function fetchStaff(businessId: string): Promise<BusinessStaff[]> {
  const result = await apiFetchData<{ staff: BusinessStaff[] }>(`/businesses/${businessId}/staff`);
  return result.staff;
}

export default function StylistStaffPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetchData<AuthMe>('/auth/me'),
    enabled: auth.isStylist,
  });

  const businessId = meQuery.data?.businessId ?? null;

  const staffQuery = useQuery({
    queryKey: ['business', businessId, 'staff'],
    queryFn: () => fetchStaff(businessId!),
    enabled: Boolean(businessId),
  });

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!businessId) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetchData(`/businesses/${businessId}/staff/invite`, {
        method: 'POST',
        json: {
          email: email.trim(),
          permissions: {
            can_manage_bookings: true,
            can_manage_pricing: false,
            can_view_payouts: false,
            can_manage_staff: false,
          },
        },
      });
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['business', businessId, 'staff'] });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send invitation'));
    } finally {
      setLoading(false);
    }
  }

  if (!auth.isStylist) {
    return (
      <PageShell>
        <p className="text-sm text-ink-muted">Stylist access only.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Team"
        subtitle="Invite staff and manage permissions (Ch.4.3)."
      />

      <div className="mt-6 space-y-4">
        <Card>
          <form className="space-y-4" onSubmit={handleInvite}>
            <Input
              label="Staff email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <FormError message={error} /> : null}
            <Button type="submit" fullWidth disabled={loading || !businessId}>
              {loading ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-medium text-ink">Current team</h2>
          </div>
          {staffQuery.isLoading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : staffQuery.data?.length ? (
            <ul className="space-y-2 text-sm text-ink-muted">
              {staffQuery.data.map((member) => (
                <li key={member.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-ink">
                    {member.inviteeEmail ?? member.inviteePhone ?? member.userId}
                  </p>
                  <p>
                    {member.acceptedAt ? 'Active' : 'Pending invitation'} · bookings{' '}
                    {member.permissions.can_manage_bookings ? 'yes' : 'no'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No staff yet.</p>
          )}
        </Card>

        <Link href="/stylist/more" className="text-sm font-medium text-primary hover:underline">
          ← Back to More
        </Link>
      </div>
    </PageShell>
  );
}
