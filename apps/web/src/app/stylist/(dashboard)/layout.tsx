'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/features/auth/require-auth';
import { BottomNav } from '@/shared/ui/bottom-nav';
import { useStylistRealtime } from '@/shared/lib/use-sse';

function StylistRealtimeBridge() {
  const queryClient = useQueryClient();

  useStylistRealtime({
    onEvent: (type) => {
      if (type === 'booking_created') {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
      if (type === 'conversation_escalated' || type === 'conversation_message') {
        void queryClient.invalidateQueries({ queryKey: ['messaging'] });
      }
    },
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
    },
  });

  return null;
}

export default function StylistDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="stylist">
      <StylistRealtimeBridge />
      {children}
      <BottomNav role="stylist" />
    </RequireAuth>
  );
}
