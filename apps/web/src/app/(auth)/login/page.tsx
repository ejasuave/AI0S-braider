'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { getWebEnv } from '@/env';
import { ApiClientError, getApiErrorMessage } from '@/shared/lib/api-client';
import {
  clearPostAuthNext,
  getPostAuthNext,
  resolvePostAuthRedirect,
  setPostAuthNext,
} from '@/shared/lib/auth-redirect';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

/** Never leave the button on “Signing in…” if a fetch hangs without aborting. */
const LOGIN_UI_FAILSAFE_MS = 15_000;

function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorRef = useRef<HTMLDivElement>(null);
  const failsafeRef = useRef<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const next = searchParams.get('next');

  useEffect(() => {
    if (next) setPostAuthNext(next);
  }, [next]);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && auth.user) {
      const redirectTo = resolvePostAuthRedirect(
        auth.isClient ? 'client' : 'stylist',
        next ?? getPostAuthNext(),
      );
      clearPostAuthNext();
      router.replace(redirectTo);
    }
  }, [auth.isAuthenticated, auth.isClient, auth.isLoading, auth.user, next, router]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (failsafeRef.current !== null) {
        window.clearTimeout(failsafeRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    if (failsafeRef.current !== null) {
      window.clearTimeout(failsafeRef.current);
    }
    failsafeRef.current = window.setTimeout(() => {
      setLoading(false);
      setError(
        `Sign-in is taking too long talking to ${apiUrl}. Check the Network tab for POST /auth/login, or restart the API.`,
      );
    }, LOGIN_UI_FAILSAFE_MS);
    try {
      const user = await auth.login({ email: email.trim(), password });
      const redirectTo = resolvePostAuthRedirect(
        user.role === 'client' ? 'client' : 'stylist',
        next ?? getPostAuthNext(),
      );
      clearPostAuthNext();
      router.replace(redirectTo);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError(
          'Your phone number is not verified yet. Register again with the same number to get a new code, then complete verification.',
        );
      } else if (err instanceof ApiClientError && err.status === 401) {
        setError(
          'Invalid email or password. Use the exact email and password from registration, after completing phone verification.',
        );
      } else if (err instanceof ApiClientError && err.status === 503) {
        setError(
          'Database is not running. From the project root run `pnpm infra:up`, then restart `pnpm dev`.',
        );
      } else if (err instanceof DOMException && err.name === 'TimeoutError') {
        setError(`Sign-in timed out talking to ${apiUrl}. Is the API running?`);
      } else if (
        err instanceof TypeError &&
        /fetch|network|Failed to fetch|Load failed/i.test(err.message)
      ) {
        setError(
          `Cannot reach the API at ${apiUrl}. If you are on localhost, run \`pnpm dev\` and ensure port 3001 is listening.`,
        );
      } else {
        setError(getApiErrorMessage(err, `Could not sign in via ${apiUrl}.`));
      }
    } finally {
      if (failsafeRef.current !== null) {
        window.clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">Welcome back</h1>
        <p className="text-sm text-ink-muted">
          Stylist sign-in — use the email and password from registration.
        </p>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div ref={errorRef}>{error ? <FormError message={error} /> : null}</div>
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-muted">
        <Link href="/forgot-password" className={TOUCH_LINK_CLASS}>
          Forgot password?
        </Link>
      </p>

      <p className="text-center text-sm text-ink-muted">
        Haven&apos;t verified your phone yet?{' '}
        <Link href="/register/stylist" className={TOUCH_LINK_CLASS}>
          Register again
        </Link>
      </p>

      <p className="text-center text-sm text-ink-muted">
        Booking as a client?{' '}
        <Link
          href={next ? `/login/client?next=${encodeURIComponent(next)}` : '/login/client'}
          className={TOUCH_LINK_CLASS}
        >
          Client sign in
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
