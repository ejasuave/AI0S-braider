'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { BusinessStaff } from '@project-braids/shared-types/api';
import { BUSINESS_STAFF_ROLE_LABELS } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

function readInviteToken(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export default function AcceptStaffInvitePage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => readInviteToken(params.token), [params.token]);
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiFetchData<{ staff: BusinessStaff }>('/staff/invitations/accept', {
        method: 'POST',
        json: { token },
      }),
    onSuccess: async (data) => {
      await auth.refreshMe();
      router.replace('/stylist');
      return data;
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not accept invitation'));
    },
  });

  const nextParam = encodeURIComponent(`/invite/${token}`);
  const clientLoginHref = `/login/client?next=${nextParam}`;
  const stylistLoginHref = `/login?next=${nextParam}`;
  const registerHref = `/register/client?next=${nextParam}`;

  if (!token) {
    return (
      <PageShell>
        <PageHeader title="Team invitation" subtitle="This invite link is missing or invalid." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Team invitation"
        subtitle="Accept to join this business as a team member."
      />

      <Card className="mt-6 space-y-4">
        {auth.isLoading ? (
          <p className="text-sm text-ink-muted">Checking your session…</p>
        ) : !auth.user ? (
          <>
            <p className="text-sm text-ink-muted">
              Sign in with the account that should join this team, then accept the invitation.
            </p>
            <Link
              href={clientLoginHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Sign in with mobile number
            </Link>
            <Link
              href={stylistLoginHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink"
            >
              Sign in with email &amp; password
            </Link>
            <p className="text-center text-sm text-ink-muted">
              New here?{' '}
              <Link href={registerHref} className="text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Signed in as {auth.user.email ?? auth.user.phoneNumber}. Accept to join the team.
            </p>
            {error ? <FormError message={error} /> : null}
            <Button
              fullWidth
              disabled={acceptMutation.isPending}
              onClick={() => {
                setError(null);
                acceptMutation.mutate();
              }}
            >
              {acceptMutation.isPending ? 'Accepting…' : 'Accept invitation'}
            </Button>
            {acceptMutation.isSuccess ? (
              <p className="text-sm text-ink-muted">
                You joined as {BUSINESS_STAFF_ROLE_LABELS[acceptMutation.data.staff.role]}.
                Redirecting…
              </p>
            ) : null}
          </>
        )}
      </Card>
    </PageShell>
  );
}
