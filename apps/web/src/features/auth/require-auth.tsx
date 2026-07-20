'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { refreshAccessToken } from '@/shared/lib/api-client';
import { getAccessToken } from '@/shared/lib/auth-storage';

/** Don't leave the whole app on "Loading…" if /auth/me is slow. */
const AUTH_LOADING_TIMEOUT_MS = 8_000;

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'stylist' | 'client';
}) {
  const auth = useAuth();
  const { isLoading, isAuthenticated, isStylist, isClient, refreshMe } = auth;
  const router = useRouter();
  const refreshAttemptedRef = useRef(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingTimedOut(true), AUTH_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading && !loadingTimedOut) return;

    if (!isAuthenticated) {
      if (!refreshAttemptedRef.current && getAccessToken()) {
        refreshAttemptedRef.current = true;
        void (async () => {
          try {
            const token = await refreshAccessToken();
            if (token) {
              await refreshMe();
              return;
            }
          } catch {
            /* refresh/network failure — fall through to login */
          }
          router.replace('/login');
        })();
        return;
      }

      router.replace('/login');
      return;
    }

    if (role === 'stylist' && !isStylist) {
      router.replace('/client');
      return;
    }

    if (role === 'client' && !isClient) {
      router.replace('/stylist');
    }
  }, [isAuthenticated, isClient, isLoading, isStylist, loadingTimedOut, refreshMe, role, router]);

  if (isLoading && !loadingTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading…</div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-ink-muted">Checking your session…</p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline"
          onClick={() => router.replace('/login')}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (role === 'stylist' && !isStylist) return null;
  if (role === 'client' && !isClient) return null;

  return children;
}
