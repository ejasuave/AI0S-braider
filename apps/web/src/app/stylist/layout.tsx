'use client';

import { RequireAuth } from '@/features/auth/require-auth';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default function StylistLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="stylist">
      {children}
      <BottomNav role="stylist" />
    </RequireAuth>
  );
}
