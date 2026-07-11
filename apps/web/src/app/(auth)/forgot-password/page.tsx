'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetchData, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetchData('/auth/password-reset/request', {
        auth: false,
        method: 'POST',
        json: { email: email.trim() },
      });
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not request password reset'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">Reset password</h1>
        <p className="text-sm text-ink-muted">
          Enter your stylist account email. If it exists, we&apos;ll send reset instructions.
        </p>
      </div>

      <Card>
        {sent ? (
          <p className="text-sm text-ink-muted">
            If an account exists for that email, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <FormError message={error} /> : null}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </Card>

      <p className="text-center text-sm text-ink-muted">
        <Link href="/login" className={TOUCH_LINK_CLASS}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
