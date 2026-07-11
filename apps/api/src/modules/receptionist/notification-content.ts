import type { NotificationType } from '@project-braids/shared-types/api';
import { formatSlotLabel } from '../../lib/scheduling/format-datetime.js';

export type NotificationContentInput = {
  type: NotificationType;
  businessName: string;
  styleName: string;
  startTime: Date;
  timeZone: string;
  cancellationReason?: string | null;
};

export function buildNotificationContent(input: NotificationContentInput): string {
  const when = formatSlotLabel(input.startTime, input.timeZone);
  const serviceLine = `${input.styleName} with ${input.businessName}`;

  switch (input.type) {
    case 'confirmation':
      return `Booking confirmed: ${serviceLine} on ${when}. See you then! Reply here if you need to change anything.`;
    case 'cancellation':
      return `Your appointment for ${serviceLine} on ${when} has been cancelled.${
        input.cancellationReason ? ` Reason: ${input.cancellationReason}.` : ''
      } Reply here to rebook.`;
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

export function buildStylistNotificationContent(input: NotificationContentInput): string {
  const when = formatSlotLabel(input.startTime, input.timeZone);
  const serviceLine = `${input.styleName}`;

  switch (input.type) {
    case 'confirmation':
      return `New booking confirmed: ${serviceLine} on ${when}.`;
    case 'cancellation':
      return `Booking cancelled: ${serviceLine} on ${when}.${
        input.cancellationReason ? ` (${input.cancellationReason})` : ''
      }`;
    case 'no_show_notice':
      return `Client marked no-show: ${serviceLine} on ${when}.`;
    case 'reminder_48h':
    case 'reminder_2h':
      return `Upcoming appointment: ${serviceLine} on ${when}.`;
    default:
      return `Booking update: ${serviceLine} on ${when}.`;
  }
}
