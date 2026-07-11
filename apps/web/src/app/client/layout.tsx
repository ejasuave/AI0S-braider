'use client';

import { RequireAuth } from '@/features/auth/require-auth';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="client">
      {children}
      <BottomNav role="client" />
    </RequireAuth>
  );
}
