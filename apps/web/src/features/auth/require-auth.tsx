'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/auth-context';

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'stylist' | 'client';
}) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoading) return;

    if (!auth.isAuthenticated) {
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
  }, [auth.isAuthenticated, auth.isClient, auth.isLoading, auth.isStylist, role, router]);

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
