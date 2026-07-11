import type { Job } from 'bullmq';
import { notificationsService } from '../modules/notifications/service.js';

export type NotificationDeliverJobData = {
  notificationId: string;
};

export async function processNotificationDeliverJob(
  job: Job<NotificationDeliverJobData>,
): Promise<{ delivered: boolean; reason?: string }> {
  return notificationsService.deliverNotification(job.data.notificationId);
}

export async function processNotificationSweepDueJob(): Promise<{ processed: number }> {
  return notificationsService.processDueNotifications();
}

export async function processNotificationSweepRemindersJob(): Promise<{ scheduled: number }> {
  return notificationsService.ensureReminderSchedules();
}
