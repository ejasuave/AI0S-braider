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

export type PhoneSignInAudience = 'client' | 'team';

type PhoneSignInFormProps = {
  audience: PhoneSignInAudience;
};

function audienceCopy(audience: PhoneSignInAudience, next: string | null) {
  if (audience === 'team') {
    return {
      title: 'Team member sign in',
      subtitle:
        'Invited staff sign in with the mobile number used for your invite — no email password needed.',
      backHref: next && next.startsWith('/') ? next : '/login',
      backLabel: '← Stylist sign in',
      createLabel:
        'New invite? Use this number, then open your invite link to join the team dashboard.',
      altHref: next ? `/login?next=${encodeURIComponent(next)}` : '/login',
      altLabel: 'Business owner? Sign in with email & password',
    };
  }
  return {
    title: 'Client sign in',
    subtitle: 'Enter your mobile number — we’ll text you a code to continue booking.',
    backHref: next && next.startsWith('/') ? next : '/directory',
    backLabel: '← Back',
    createLabel: null as string | null,
    altHref: '/login',
    altLabel: 'Stylist sign in',
  };
}

function PhoneSignInForm({ audience }: PhoneSignInFormProps) {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = searchParams.get('next');
  const copy = audienceCopy(audience, next);
  const showDevHint =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME?.includes('(Staging)');

  useEffect(() => {
    if (next) setPostAuthNext(next);
  }, [next]);

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) return;
    if (audience === 'team') {
      if (auth.isStylist || auth.isClient) {
        router.replace(next ?? (auth.isStylist ? '/stylist' : '/'));
      }
      return;
    }
    if (auth.isClient) {
      router.replace(next ?? '/client');
    }
  }, [
    audience,
    auth.isAuthenticated,
    auth.isClient,
    auth.isLoading,
    auth.isStylist,
    next,
    router,
  ]);

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
      // Phone OTP accounts start as client; accepting a team invite upgrades to stylist_staff.
      await auth.registerClient({ phoneNumber: normalizedPhone, audience });
      window.location.assign('/verify');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send sign-in code'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={copy.backHref} className="text-sm font-medium text-primary hover:underline">
          {copy.backLabel}
        </Link>
        <h1 className="font-display text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="text-sm text-ink-muted">{copy.subtitle}</p>
        {showDevHint ? (
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

      {copy.createLabel ? (
        <p className="text-center text-sm text-ink-muted">{copy.createLabel}</p>
      ) : (
        <p className="text-center text-sm text-ink-muted">
          New here?{' '}
          <Link
            href={next ? `/register/client?next=${encodeURIComponent(next)}` : '/register/client'}
            className="font-medium text-primary hover:underline"
          >
            Create a client account
          </Link>
        </p>
      )}

      <p className="text-center text-sm text-ink-muted">
        {audience === 'team' ? 'Business owner? ' : 'Are you a stylist? '}
        <Link href={copy.altHref} className="font-medium text-primary hover:underline">
          {copy.altLabel}
        </Link>
      </p>
    </div>
  );
}

export function PhoneSignInPage({ audience }: PhoneSignInFormProps) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <PhoneSignInForm audience={audience} />
    </Suspense>
  );
}
