'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getPostAuthPath } from '@/features/auth/auth-context';
import { ApiClientError, getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { FormError } from '@/shared/ui/form-error';
import { TOUCH_LINK_CLASS } from '@/shared/lib/touch-target';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && auth.user) {
      router.replace(getPostAuthPath(auth.user));
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.user, router]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await auth.login({ email: email.trim(), password });
      // Soft navigate so the session already in AuthProvider is kept — a hard reload
      // left the dashboard stuck on "Loading…" while /auth/me re-fetched.
      router.replace(getPostAuthPath(user));
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
        setError('Sign-in timed out. Check your connection and try again.');
      } else if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
        setError(
          'Cannot reach the API server. From the project root, run `pnpm dev` and ensure port 3001 is listening.',
        );
      } else {
        setError(getApiErrorMessage(err, 'Could not sign in. Is the API running on port 3001?'));
      }
    } finally {
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
        <Link href="/login/client" className={TOUCH_LINK_CLASS}>
          Client sign in
        </Link>
      </p>
    </div>
  );
}
