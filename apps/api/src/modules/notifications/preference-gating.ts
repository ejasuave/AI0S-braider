import type { DepositDisposition, NotificationType } from '@project-braids/shared-types/api';
import {
  REMINDER_NOTIFICATION_TYPES,
  TRANSACTIONAL_NOTIFICATION_TYPES,
} from '@project-braids/shared-types/api';

/**
 * Ch.12.3 / 12.4 — only reminder types may be gated by appointment_reminders_enabled.
 * Transactional types must never check marketing_messages_enabled.
 */
export function isReminderNotificationType(type: NotificationType): boolean {
  return (REMINDER_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function isTransactionalNotificationType(type: NotificationType): boolean {
  return (TRANSACTIONAL_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function shouldCheckAppointmentRemindersPreference(type: NotificationType): boolean {
  return isReminderNotificationType(type);
}

export function shouldCheckMarketingPreference(_type: NotificationType): boolean {
  return false;
}

export function depositDispositionLabel(disposition: DepositDisposition): string {
  switch (disposition) {
    case 'full_refund':
      return 'Your deposit will be refunded.';
    case 'forfeit_deposit':
      return 'Your deposit is non-refundable under the cancellation policy.';
    case 'no_action':
      return '';
    default:
      return '';
  }
}
