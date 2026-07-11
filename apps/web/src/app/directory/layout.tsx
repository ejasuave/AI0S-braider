'use client';

import { useAuth } from '@/features/auth/auth-context';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <>
      {children}
      {auth.isClient ? <BottomNav role="client" /> : null}
    </>
  );
}
