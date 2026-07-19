'use client';

import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

function formatUkDisplay(e164: string): string {
  if (e164.startsWith('+44') && e164.length >= 13) {
    const national = `0${e164.slice(3)}`;
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return e164;
}

type TextSmsCtaProps = {
  smsBookingNumber: string | null | undefined;
  stylistName?: string;
  /** Compact variant for embedding under other actions */
  compact?: boolean;
};

/** MVP: AI receptionist is SMS-only — open the device SMS app to the stylist's booking number. */
export function TextSmsCta({ smsBookingNumber, stylistName, compact = false }: TextSmsCtaProps) {
  if (!smsBookingNumber) {
    if (compact) return null;
    return (
      <Card className="space-y-1 bg-surface-muted">
        <p className="text-sm font-medium text-ink">Message this stylist</p>
        <p className="text-sm text-ink-muted">
          This stylist has not published an SMS booking number yet. Use Book appointment, or check
          back later.
        </p>
      </Card>
    );
  }

  const display = formatUkDisplay(smsBookingNumber);
  const href = `sms:${smsBookingNumber}`;
  const who = stylistName ? `${stylistName}'s` : "this stylist's";

  if (compact) {
    return (
      <a href={href} className="block">
        <Button type="button" variant="secondary" fullWidth>
          Text AI receptionist
        </Button>
      </a>
    );
  }

  return (
    <Card className="space-y-3 bg-primary-subtle border-primary/20">
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">Chat with the AI receptionist</p>
        <p className="text-sm text-ink-muted">
          Text {who} booking number — the AI answers by SMS (same thread shows up in Messages).
        </p>
        <p className="text-sm font-medium text-ink">{display}</p>
      </div>
      <a href={href}>
        <Button type="button" fullWidth>
          Open Messages &amp; text
        </Button>
      </a>
    </Card>
  );
}
