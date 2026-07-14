import {
  generateNotificationContent,
  type NotificationContentContext,
} from '../notifications/content.js';

export { generateNotificationContent, type NotificationContentContext };

export type NotificationContentInput = Omit<NotificationContentContext, 'audience'>;

export function buildNotificationContent(input: NotificationContentInput): string {
  return generateNotificationContent({ ...input, audience: 'client' });
}

export function buildStylistNotificationContent(input: NotificationContentInput): string {
  return generateNotificationContent({ ...input, audience: 'stylist' });
}
