'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BusinessStaff } from '@project-braids/shared-types/api';
import { BUSINESS_STAFF_ROLE_LABELS } from '@project-braids/shared-types/api';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { PageHeader, PageShell } from '@/shared/ui/page-shell';

export default function AcceptStaffInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
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
  const loginHref = `/login/client?next=${nextParam}`;
  const registerHref = `/register/client?next=${nextParam}`;

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
              Sign in with the email or phone that received this invitation, then accept.
            </p>
            <Link
              href={loginHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Sign in to accept
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
