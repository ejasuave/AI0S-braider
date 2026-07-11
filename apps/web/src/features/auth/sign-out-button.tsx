'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/shared/ui/button';

export function SignOutButton({
  redirectTo = '/',
  className,
}: {
  redirectTo?: string;
  className?: string;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await auth.logout();
      window.location.assign(redirectTo);
    } catch {
      router.replace(redirectTo);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      fullWidth
      className={className}
      onClick={() => void handleSignOut()}
      disabled={loading}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
