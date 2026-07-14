'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setError('Reset link is invalid or missing a token.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetchData('/auth/password-reset/confirm', {
        auth: false,
        method: 'POST',
        json: { token, password },
      });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">
          Choose a new password
        </h1>
      </div>

      <Card>
        {done ? (
          <p className="text-sm text-ink-muted">
            Password updated.{' '}
            <Link href="/login" className={TOUCH_LINK_CLASS}>
              Sign in
            </Link>
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? <FormError message={error} /> : null}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
