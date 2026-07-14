import type { DepositDisposition, NotificationType } from '@project-braids/shared-types/api';
import { formatSlotLabel } from '../../lib/scheduling/format-datetime.js';
import { depositDispositionLabel } from './preference-gating.js';

export type NotificationContentContext = {
  type: NotificationType;
  businessName: string;
  styleName: string;
  startTime: Date;
  timeZone: string;
  cancellationReason?: string | null;
  depositDisposition?: DepositDisposition;
  depositAmount?: number | null;
  depositPaid?: boolean;
  audience: 'client' | 'stylist';
};

/**
 * Templated notification copy for automated delivery (Ch.12.1).
 * Chapter 13 may eventually enrich this with the same AI content layer used in live
 * conversation; this baseline must work without any AI call succeeding.
 */
export function generateNotificationContent(context: NotificationContentContext): string {
  const when = formatSlotLabel(context.startTime, context.timeZone);
  const serviceLine = `${context.styleName} with ${context.businessName}`;

  if (context.audience === 'stylist') {
    return generateStylistNotificationContent(context, when, context.styleName);
  }

  switch (context.type) {
    case 'confirmation': {
      const depositLine =
        context.depositPaid && context.depositAmount
          ? ` £${context.depositAmount} deposit paid.`
          : '';
      return `Booking confirmed: ${serviceLine} on ${when}.${depositLine} See you then! Reply here if you need to change anything.`;
    }
    case 'cancellation': {
      const dispositionLine = context.depositDisposition
        ? ` ${depositDispositionLabel(context.depositDisposition)}`
        : '';
      return `Your appointment for ${serviceLine} on ${when} has been cancelled.${
        context.cancellationReason ? ` Reason: ${context.cancellationReason}.` : ''
      }${dispositionLine} Reply here to rebook.`;
    }
    case 'no_show_notice':
      return `We missed you for ${serviceLine} on ${when}. Reply here if you'd like to reschedule.`;
    case 'reminder_48h':
      return `Reminder: ${serviceLine} is in 48 hours (${when}). Reply here if you need to reschedule.`;
    case 'reminder_2h':
      return `Reminder: ${serviceLine} starts in 2 hours (${when}). See you soon!`;
    default:
      return `Update for your appointment: ${serviceLine} on ${when}.`;
  }
}

function generateStylistNotificationContent(
  context: NotificationContentContext,
  when: string,
  serviceLine: string,
): string {
  switch (context.type) {
    case 'confirmation': {
      const depositLine =
        context.depositPaid && context.depositAmount
          ? `, £${context.depositAmount} deposit paid`
          : '';
      return `New booking confirmed: ${serviceLine} on ${when}${depositLine}.`;
    }
    case 'cancellation':
      return `Booking cancelled: ${serviceLine} on ${when}.${
        context.cancellationReason ? ` (${context.cancellationReason})` : ''
      }${
        context.depositDisposition
          ? ` Deposit outcome: ${context.depositDisposition.replaceAll('_', ' ')}.`
          : ''
      }`;
    case 'no_show_notice':
      return `Client marked no-show: ${serviceLine} on ${when}.${
        context.depositDisposition === 'forfeit_deposit'
          ? ' Deposit forfeited.'
          : context.depositDisposition === 'full_refund'
            ? ' Deposit refunded.'
            : ''
      }`;
    case 'reminder_48h':
    case 'reminder_2h':
      return `Upcoming appointment: ${serviceLine} on ${when}.`;
    default:
      return `Booking update: ${serviceLine} on ${when}.`;
  }
}
