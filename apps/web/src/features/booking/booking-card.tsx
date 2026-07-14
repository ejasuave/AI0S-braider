import type { Booking } from '@project-braids/shared-types/api';
import Link from 'next/link';
import {
  bookingStatusLabel,
  bookingStatusTone,
  depositStatusLabel,
  formatDateTime,
  formatMoney,
} from '@/shared/lib/format';
import { serviceVenueModeLabel } from '@/shared/lib/venue';
import { StatusBadge } from '@/shared/ui/status-badge';
import { Card } from '@/shared/ui/card';

export function BookingCard({
  booking,
  href,
  showClient = false,
}: {
  booking: Booking;
  href: string;
  showClient?: boolean;
}) {
  const clientLabel =
    booking.clientDisplayName?.trim() ||
    booking.clientPhoneNumber ||
    (booking.clientId ? 'Client' : null);

  return (
    <Link href={href} className="block transition-opacity active:opacity-90">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {showClient && clientLabel ? (
              <p className="font-medium text-ink">{clientLabel}</p>
            ) : null}
            <p className={`font-medium text-ink ${showClient && clientLabel ? 'text-sm' : ''}`}>
              {formatDateTime(booking.startTime)}
            </p>
            <p className="text-sm text-ink-muted">
              {formatMoney(booking.agreedPrice)} · {booking.agreedDurationMinutes} min
            </p>
            <p className="text-xs text-ink-muted">
              {serviceVenueModeLabel(booking.serviceVenueMode)}
              {booking.venueAddress ? ` · ${booking.venueAddress}` : ''}
            </p>
          </div>
          <StatusBadge
            label={bookingStatusLabel(booking.status)}
            tone={bookingStatusTone(booking.status)}
            className="shrink-0"
          />
        </div>
        <p className="text-xs text-ink-muted">{depositStatusLabel(booking.depositStatus)}</p>
      </Card>
    </Link>
  );
}
