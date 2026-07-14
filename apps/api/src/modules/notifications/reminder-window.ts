import {
  REMINDER_NOTIFICATION_TYPES,
  type ReminderNotificationType,
} from '@project-braids/shared-types/api';

export function calculateReminderScheduledFor(
  appointmentStart: Date,
  reminderType: ReminderNotificationType,
  now: Date = new Date(),
): Date | null {
  const offsetHours = reminderType === 'reminder_48h' ? 48 : reminderType === 'reminder_2h' ? 2 : 0;
  const scheduledFor = new Date(appointmentStart.getTime() - offsetHours * 60 * 60 * 1000);

  if (scheduledFor.getTime() <= now.getTime()) {
    return null;
  }

  return scheduledFor;
}

export function reminderTypesForBooking(
  appointmentStart: Date,
  now: Date = new Date(),
): ReminderNotificationType[] {
  return REMINDER_NOTIFICATION_TYPES.filter(
    (type) => calculateReminderScheduledFor(appointmentStart, type, now) !== null,
  );
}
