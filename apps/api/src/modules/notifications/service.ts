import type { DepositDisposition } from '@project-braids/shared-types/api';
import type { NotificationType } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import { getSystemQueue, JOB_NAMES } from '../../lib/queue.js';
import { messagingService } from '../messaging/service.js';
import { prisma } from '../../lib/db.js';
import { generateNotificationContent, formatVenueLineForNotification } from './content.js';
import { notificationsRepository } from './repository.js';
import { calculateReminderScheduledFor, reminderTypesForBooking } from './reminder-window.js';
import {
  shouldCheckAppointmentRemindersPreference,
  shouldCheckMarketingPreference,
} from './preference-gating.js';

export class NotificationsService {
  async onBookingConfirmed(bookingId: string): Promise<void> {
    const context = await notificationsRepository.getBookingContext(bookingId);
    if (!context || context.status !== 'confirmed') {
      return;
    }

    await this.scheduleImmediate({
      bookingId,
      recipientId: context.clientId,
      type: 'confirmation',
    });
    await this.scheduleImmediate({
      bookingId,
      recipientId: context.stylistUserId,
      type: 'confirmation',
    });

    await this.scheduleRemindersForBooking(bookingId);
  }

  async onBookingCancelled(
    bookingId: string,
    depositDisposition: DepositDisposition,
  ): Promise<void> {
    await notificationsRepository.cancelPendingForBooking(bookingId);

    const context = await notificationsRepository.getBookingContext(bookingId);
    if (!context) return;

    await this.scheduleImmediate({
      bookingId,
      recipientId: context.clientId,
      type: 'cancellation',
      depositDisposition,
    });
    await this.scheduleImmediate({
      bookingId,
      recipientId: context.stylistUserId,
      type: 'cancellation',
      depositDisposition,
    });
  }

  async onBookingNoShow(bookingId: string, depositDisposition: DepositDisposition): Promise<void> {
    await notificationsRepository.cancelPendingForBooking(bookingId);

    const context = await notificationsRepository.getBookingContext(bookingId);
    if (!context) return;

    await this.scheduleImmediate({
      bookingId,
      recipientId: context.stylistUserId,
      type: 'no_show_notice',
      depositDisposition,
    });
  }

  async onBookingTimeChanged(bookingId: string): Promise<void> {
    await notificationsRepository.cancelPendingForBooking(bookingId);
    await this.scheduleRemindersForBooking(bookingId);
  }

  async scheduleRemindersForBooking(bookingId: string): Promise<void> {
    const context = await notificationsRepository.getBookingContext(bookingId);
    if (!context || context.status !== 'confirmed') {
      return;
    }

    for (const reminderType of reminderTypesForBooking(context.startTime)) {
      const scheduledFor = calculateReminderScheduledFor(context.startTime, reminderType);
      if (!scheduledFor) continue;

      await notificationsRepository.upsertScheduledNotification({
        bookingId,
        recipientId: context.clientId,
        type: reminderType,
        scheduledFor,
      });
    }
  }

  async ensureReminderSchedules(limit = 50): Promise<{ scheduled: number }> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        startTime: { gt: new Date() },
      },
      select: { id: true },
      take: limit,
      orderBy: { startTime: 'asc' },
    });

    for (const booking of bookings) {
      await this.scheduleRemindersForBooking(booking.id);
    }
    return { scheduled: bookings.length };
  }

  private async scheduleImmediate(input: {
    bookingId: string;
    recipientId: string;
    type: NotificationType;
    depositDisposition?: DepositDisposition;
  }): Promise<void> {
    const notification = await notificationsRepository.upsertScheduledNotification({
      bookingId: input.bookingId,
      recipientId: input.recipientId,
      type: input.type,
      scheduledFor: new Date(),
      depositDisposition: input.depositDisposition ?? null,
    });

    await this.enqueueDelivery(notification.id);
  }

  async enqueueDelivery(notificationId: string): Promise<void> {
    void getSystemQueue()
      .add(
        JOB_NAMES.NOTIFICATION_DELIVER,
        { notificationId },
        { jobId: `notification-deliver-${notificationId}` },
      )
      .catch(() => {
        // Redis may be unavailable in some dev/test environments.
      });
  }

  async deliverNotification(
    notificationId: string,
  ): Promise<{ delivered: boolean; reason?: string }> {
    const notification = await notificationsRepository.getNotificationById(notificationId);
    if (!notification || notification.status !== 'scheduled') {
      return { delivered: false, reason: 'not_scheduled' };
    }

    if (!notification.bookingId) {
      await notificationsRepository.markFailed(notificationId, 'missing_booking');
      return { delivered: false, reason: 'missing_booking' };
    }

    const context = await notificationsRepository.getBookingContext(notification.bookingId);
    if (!context) {
      await notificationsRepository.markFailed(notificationId, 'booking_not_found');
      return { delivered: false, reason: 'booking_not_found' };
    }

    if (
      (notification.type === 'reminder_48h' || notification.type === 'reminder_2h') &&
      context.status !== 'confirmed'
    ) {
      await notificationsRepository.markSkipped(notificationId, 'booking_not_confirmed');
      return { delivered: false, reason: 'booking_not_confirmed' };
    }

    if (notification.type === 'cancellation' && context.status !== 'cancelled') {
      await notificationsRepository.markSkipped(notificationId, 'booking_not_cancelled');
      return { delivered: false, reason: 'booking_not_cancelled' };
    }

    const isClientRecipient = notification.recipientId === context.clientId;
    const isStylistRecipient = notification.recipientId === context.stylistUserId;

    if (!isClientRecipient && !isStylistRecipient) {
      await notificationsRepository.markFailed(notificationId, 'unknown_recipient');
      return { delivered: false, reason: 'unknown_recipient' };
    }

    if (isClientRecipient && shouldCheckAppointmentRemindersPreference(notification.type)) {
      const preferences = await notificationsRepository.getRecipientPreferences(context.clientId);
      if (preferences && !preferences.appointmentRemindersEnabled) {
        await notificationsRepository.markSkipped(notificationId, 'appointment_reminders_disabled');
        return { delivered: false, reason: 'appointment_reminders_disabled' };
      }
    }

    if (shouldCheckMarketingPreference(notification.type)) {
      const preferences = await notificationsRepository.getRecipientPreferences(
        notification.recipientId,
      );
      if (preferences && !preferences.marketingMessagesEnabled) {
        await notificationsRepository.markSkipped(notificationId, 'marketing_messages_disabled');
        return { delivered: false, reason: 'marketing_messages_disabled' };
      }
    }

    const env = getEnv();

    if (
      isClientRecipient &&
      (notification.type === 'reminder_48h' || notification.type === 'reminder_2h')
    ) {
      const active = await notificationsRepository.hasActiveConversationRecently({
        stylistId: context.stylistId,
        clientId: context.clientId,
        withinMinutes: env.NOTIFICATION_ACTIVE_CONVERSATION_DEFERRAL_MINUTES,
      });
      if (active) {
        const deferUntil = new Date(
          Date.now() + env.NOTIFICATION_ACTIVE_CONVERSATION_DEFERRAL_MINUTES * 60_000,
        );
        await notificationsRepository.deferNotification(notificationId, deferUntil);
        return { delivered: false, reason: 'deferred_active_conversation' };
      }
    }

    const depositDisposition = notification.depositDisposition as DepositDisposition | null;

    const venueLine = formatVenueLineForNotification({
      mode: context.serviceVenueMode,
      address: context.venueAddress,
      audience: isClientRecipient ? 'client' : 'stylist',
    });

    const contentInput = {
      type: notification.type,
      businessName: context.businessName,
      styleName: context.styleName,
      startTime: context.startTime,
      timeZone: env.PLATFORM_TIMEZONE,
      cancellationReason: context.cancellationReason,
      depositDisposition: depositDisposition ?? undefined,
      depositAmount: context.depositAmount,
      depositPaid: context.depositStatus === 'paid',
      audience: isClientRecipient ? ('client' as const) : ('stylist' as const),
      venueLine,
      clientDisplayName: context.clientDisplayName,
    };

    const body = generateNotificationContent(contentInput);

    if (isClientRecipient) {
      const conversation = await messagingService.findOrCreateSmsConversation({
        stylistId: context.stylistId,
        clientId: context.clientId,
      });
      await messagingService.sendOutboundMessage({
        conversationId: conversation.id,
        sender: 'system',
        content: body,
      });
    } else {
      await messagingService.sendDirectSms({
        to: context.stylistPhone,
        body,
      });
    }

    await notificationsRepository.markSent(notificationId);
    return { delivered: true };
  }

  async processDueNotifications(limit = 25): Promise<{ processed: number }> {
    const due = await notificationsRepository.listDueNotifications(limit);
    for (const notification of due) {
      await this.deliverNotification(notification.id);
    }
    return { processed: due.length };
  }
}

export const notificationsService = new NotificationsService();
