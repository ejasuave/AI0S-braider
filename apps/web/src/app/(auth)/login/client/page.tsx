'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { getApiErrorMessage } from '@/shared/lib/api-client';
import { setPostAuthNext } from '@/shared/lib/auth-redirect';
import { formatPhoneHint, isValidE164Phone, normalizePhoneNumber } from '@/shared/lib/phone';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';

function ClientLoginForm() {
  const auth = useAuth();
  const router = useRouter();
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

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && auth.isClient) {
      router.replace(next ?? '/client');
    }
  }, [auth.isAuthenticated, auth.isClient, auth.isLoading, next, router]);

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
      setError(getApiErrorMessage(err, 'Could not send sign-in code'));
    } finally {
      setLoading(false);
    }
  }

  const registerHref = next
    ? `/register/client?next=${encodeURIComponent(next)}`
    : '/register/client';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={next && next.startsWith('/') ? next : '/directory'}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl font-semibold text-ink">Client sign in</h1>
        <p className="text-sm text-ink-muted">
          Enter your mobile number — we&apos;ll text you a code to continue booking.
        </p>
        {process.env.NODE_ENV !== 'production' ||
        process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME?.includes('(Staging)') ? (
          <p className="text-xs text-ai">Staging/local: codes appear on the next screen, not by SMS.</p>
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
            {loading ? 'Sending code…' : 'Send sign-in code'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-muted">
        New here?{' '}
        <Link href={registerHref} className="font-medium text-primary hover:underline">
          Create a client account
        </Link>
      </p>

      <p className="text-center text-sm text-ink-muted">
        Are you a stylist?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Stylist sign in
        </Link>
      </p>
    </div>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <ClientLoginForm />
    </Suspense>
  );
}
