import { calendarSyncService } from '../calendar/sync.js';

/** Ch.8.2 — delegates platform booking sync to the Calendar module. */
export async function pushToExternalCalendar(bookingId: string): Promise<void> {
  await calendarSyncService.pushToExternalCalendar(bookingId);
}

export async function removeExternalCalendarEvent(bookingId: string): Promise<void> {
  await calendarSyncService.removeExternalCalendarEvent(bookingId);
}
