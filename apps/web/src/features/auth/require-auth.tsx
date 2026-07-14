'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { refreshAccessToken } from '@/shared/lib/api-client';
import { getAccessToken } from '@/shared/lib/auth-storage';

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'stylist' | 'client';
}) {
  const auth = useAuth();
  const router = useRouter();
  const refreshAttemptedRef = useRef(false);

  useEffect(() => {
    if (auth.isLoading) return;

    if (!auth.isAuthenticated) {
      if (!refreshAttemptedRef.current && getAccessToken()) {
        refreshAttemptedRef.current = true;
        void (async () => {
          const token = await refreshAccessToken();
          if (token) {
            await auth.refreshMe();
            return;
          }
          router.replace('/login');
        })();
        return;
      }

      router.replace('/login');
      return;
    }

    if (role === 'stylist' && !auth.isStylist) {
      router.replace('/client');
      return;
    }

    if (role === 'client' && !auth.isClient) {
      router.replace('/stylist');
    }
  }, [
    auth.isAuthenticated,
    auth.isClient,
    auth.isLoading,
    auth.isStylist,
    auth.refreshMe,
    role,
    router,
  ]);

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading…</div>
    );
  }

  if (!auth.isAuthenticated) {
    return null;
  }

  if (role === 'stylist' && !auth.isStylist) return null;
  if (role === 'client' && !auth.isClient) return null;

  return children;
}
