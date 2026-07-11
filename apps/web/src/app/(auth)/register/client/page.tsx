'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { getApiErrorMessage } from '@/shared/lib/api-client';
import { setPostAuthNext } from '@/shared/lib/auth-redirect';
import { formatPhoneHint, isValidE164Phone, normalizePhoneNumber } from '@/shared/lib/phone';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';

function RegisterClientForm() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = searchParams.get('next');

  useEffect(() => {
    if (next) {
      setPostAuthNext(next);
    }
  }, [next]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!isValidE164Phone(normalizedPhone)) {
      setError(`Enter a valid UK mobile number. ${formatPhoneHint()}`);
      setLoading(false);
      return;
    }

    try {
      await auth.registerClient({ phoneNumber: normalizedPhone });
      window.location.assign('/verify');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create account'));
    } finally {
      setLoading(false);
    }
  }

  const loginHref = next ? `/login/client?next=${encodeURIComponent(next)}` : '/login/client';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          ← Back
        </Link>
        <h1 className="font-display text-3xl font-semibold text-ink">Client account</h1>
        <p className="text-sm text-ink-muted">Verify your phone to book and pay deposits.</p>
        {process.env.NODE_ENV !== 'production' ? (
          <p className="text-xs text-ai">
            Local dev: codes are not sent by SMS — you&apos;ll see your code on the next screen.
          </p>
        ) : null}
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            hint={formatPhoneHint()}
            required
          />
          {error ? <FormError message={error} /> : null}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating account…' : 'Continue'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href={loginHref} className="font-medium text-primary hover:underline">
          Sign in with your phone
        </Link>
      </p>
    </div>
  );
}

export default function RegisterClientPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <RegisterClientForm />
    </Suspense>
  );
}
