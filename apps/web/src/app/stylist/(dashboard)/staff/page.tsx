'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import {
  BUSINESS_STAFF_ROLE_LABELS,
  BUSINESS_STAFF_ROLES,
  STAFF_ROLE_PERMISSION_PRESETS,
  type BusinessStaff,
  type BusinessStaffRole,
} from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { Input } from '@/shared/ui/input';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

type AuthMe = {
  businessId: string | null;
};

async function fetchStaff(businessId: string): Promise<BusinessStaff[]> {
  const result = await apiFetchData<{ staff: BusinessStaff[] }>(`/businesses/${businessId}/staff`);
  return result.staff;
}

function statusLabel(member: BusinessStaff): string {
  switch (member.status) {
    case 'active':
      return 'Active';
    case 'deactivated':
      return 'Deactivated';
    default:
      return 'Pending invitation';
  }
}

export default function StylistStaffPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BusinessStaffRole>('stylist');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

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

  async function refreshStaff() {
    if (!businessId) return;
    await queryClient.invalidateQueries({ queryKey: ['business', businessId, 'staff'] });
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!businessId) return;
    setError(null);
    setSuccess(null);
    setAcceptUrl(null);
    setLoading(true);
    try {
      const result = await apiFetchData<{
        invitation: BusinessStaff;
        acceptUrl: string;
      }>(`/businesses/${businessId}/staff/invite`, {
        method: 'POST',
        json: {
          email: email.trim(),
          role,
          permissions: { ...STAFF_ROLE_PERMISSION_PRESETS[role] },
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        },
      });
      setEmail('');
      setDisplayName('');
      setAcceptUrl(result.acceptUrl);
      setSuccess(
        'Invitation created. If the email does not arrive (Resend test mode / spam), use the link below.',
      );
      await refreshStaff();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send invitation'));
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    staffId: string,
    action: () => Promise<string | void>,
    okMessage: string,
  ) {
    setError(null);
    setSuccess(null);
    setAcceptUrl(null);
    setActionId(staffId);
    try {
      const maybeUrl = await action();
      if (typeof maybeUrl === 'string') setAcceptUrl(maybeUrl);
      setSuccess(okMessage);
      await refreshStaff();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update team member'));
    } finally {
      setActionId(null);
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
        subtitle="Invite staff with a role. They get a secure email link that expires in 7 days."
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
            <Input
              label="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maya"
            />
            <label className="block text-sm font-medium text-ink">
              Role
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as BusinessStaffRole)}
              >
                {BUSINESS_STAFF_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {BUSINESS_STAFF_ROLE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-muted">
              Manager can manage bookings, pricing, profile, and staff. Stylist and Receptionist can
              manage bookings.
            </p>
            {error ? <FormError message={error} /> : null}
            {success ? <p className="text-sm text-ink-muted">{success}</p> : null}
            {acceptUrl ? (
              <div className="space-y-2 rounded-md border border-border bg-surface-raised p-3">
                <p className="text-xs font-medium text-ink">Accept link</p>
                <p className="break-all text-xs text-ink-muted">{acceptUrl}</p>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => void navigator.clipboard.writeText(acceptUrl)}
                >
                  Copy link
                </Button>
              </div>
            ) : null}
            <Button type="submit" fullWidth disabled={loading || !businessId}>
              {loading ? 'Sending…' : 'Invite staff'}
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
            <ul className="space-y-3 text-sm">
              {staffQuery.data.map((member) => (
                <li key={member.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-ink">
                      {member.displayName ||
                        member.inviteeEmail ||
                        member.inviteePhone ||
                        member.userId}
                    </p>
                    <p className="text-ink-muted">
                      {BUSINESS_STAFF_ROLE_LABELS[member.role]} · {statusLabel(member)}
                      {member.inviteExpiresAt && member.status === 'pending'
                        ? ` · expires ${new Date(member.inviteExpiresAt).toLocaleDateString('en-GB')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {member.status === 'pending' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionId === member.id || !businessId}
                        onClick={() =>
                          void runAction(
                            member.id,
                            () =>
                              apiFetchData<{ acceptUrl: string }>(
                                `/businesses/${businessId}/staff/${member.id}/resend`,
                                { method: 'POST' },
                              ).then((data) => data.acceptUrl),
                            'Invitation resent — use the link below if email is delayed.',
                          )
                        }
                      >
                        Resend
                      </Button>
                    ) : null}
                    {member.status === 'active' ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-ink-muted">
                          Role
                          <select
                            className="rounded-md border border-border bg-surface px-2 py-1"
                            value={member.role}
                            disabled={actionId === member.id}
                            onChange={(e) => {
                              const nextRole = e.target.value as BusinessStaffRole;
                              void runAction(
                                member.id,
                                () =>
                                  apiFetchData(`/businesses/${businessId}/staff/${member.id}`, {
                                    method: 'PATCH',
                                    json: {
                                      role: nextRole,
                                      permissions: { ...STAFF_ROLE_PERMISSION_PRESETS[nextRole] },
                                    },
                                  }).then(() => undefined),
                                'Role updated.',
                              );
                            }}
                          >
                            {BUSINESS_STAFF_ROLES.map((value) => (
                              <option key={value} value={value}>
                                {BUSINESS_STAFF_ROLE_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={actionId === member.id}
                          onClick={() =>
                            void runAction(
                              member.id,
                              () =>
                                apiFetchData(
                                  `/businesses/${businessId}/staff/${member.id}/deactivate`,
                                  { method: 'POST' },
                                ).then(() => undefined),
                              'Team member deactivated.',
                            )
                          }
                        >
                          Deactivate
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actionId === member.id}
                      onClick={() =>
                        void runAction(
                          member.id,
                          () =>
                            apiFetchData(`/businesses/${businessId}/staff/${member.id}`, {
                              method: 'DELETE',
                            }).then(() => undefined),
                          'Team member removed.',
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
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
