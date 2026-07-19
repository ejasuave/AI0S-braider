'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { startClientConversation } from '@/features/messaging/api';
import { getApiErrorMessage } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

type MessageStylistButtonProps = {
  stylistId: string;
  stylistName?: string;
  /** Compact button only (no card wrapper) */
  compact?: boolean;
  fullWidth?: boolean;
};

/** Start or resume an in-app web chat with the stylist's AI receptionist. */
export function MessageStylistButton({
  stylistId,
  stylistName,
  compact = false,
  fullWidth = true,
}: MessageStylistButtonProps) {
  const auth = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMessage() {
    setError(null);

    if (!auth.user) {
      const next = `/directory/${stylistId}`;
      router.push(`/login/client?next=${encodeURIComponent(next)}`);
      return;
    }

    if (auth.user.role !== 'client') {
      setError('Sign in with a client account to message this stylist.');
      return;
    }

    setPending(true);
    try {
      const { conversationId } = await startClientConversation(stylistId);
      router.push(`/client/inbox/${conversationId}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const button = (
    <Button type="button" fullWidth={fullWidth} disabled={pending} onClick={() => void handleMessage()}>
      {pending ? 'Opening chat…' : 'Message AI receptionist'}
    </Button>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {button}
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </div>
    );
  }

  const who = stylistName ? stylistName : 'this stylist';

  return (
    <Card className="space-y-3 border-primary/20 bg-primary-subtle">
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">Chat in the app</p>
        <p className="text-sm text-ink-muted">
          Message {who}&apos;s AI receptionist here — ask about styles, availability, and bookings.
        </p>
      </div>
      {button}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </Card>
  );
}
