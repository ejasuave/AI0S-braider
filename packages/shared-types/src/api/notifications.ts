import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'reminder_48h',
  'reminder_2h',
  'confirmation',
  'cancellation',
  'no_show_notice',
]);

export const notificationStatusSchema = z.enum([
  'scheduled',
  'sent',
  'failed',
  'skipped',
  'cancelled',
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  recipientId: z.string().uuid(),
  type: notificationTypeSchema,
  status: notificationStatusSchema,
  scheduledFor: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const REMINDER_NOTIFICATION_TYPES = ['reminder_48h', 'reminder_2h'] as const;
export type ReminderNotificationType = (typeof REMINDER_NOTIFICATION_TYPES)[number];

export const REMINDER_OFFSET_HOURS: Record<ReminderNotificationType, number> = {
  reminder_48h: 48,
  reminder_2h: 2,
};
