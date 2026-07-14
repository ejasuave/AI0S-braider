import {
  onBookingCancelled,
  onBookingConfirmed,
  onBookingNoShow,
  onBookingTimeChanged,
} from '../../lib/domain-events.js';
import { notificationsService } from './service.js';

/** Ch.12.2/12.3 — subscribe to booking lifecycle without Booking importing Notifications. */
onBookingConfirmed(async ({ bookingId }) => {
  await notificationsService.onBookingConfirmed(bookingId);
});

onBookingCancelled(async ({ bookingId, depositDisposition }) => {
  await notificationsService.onBookingCancelled(bookingId, depositDisposition);
});

onBookingNoShow(async ({ bookingId, depositDisposition }) => {
  await notificationsService.onBookingNoShow(bookingId, depositDisposition);
});

onBookingTimeChanged(async ({ bookingId }) => {
  await notificationsService.onBookingTimeChanged(bookingId);
});
