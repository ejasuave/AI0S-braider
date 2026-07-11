import type { NotificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '../../lib/db.js';

export type NotificationRecord = {
  id: string;
  bookingId: string;
  recipientId: string;
  type: NotificationType;
  status: NotificationStatus;
  scheduledFor: Date | null;
};

export type BookingNotificationContext = {
  id: string;
  stylistId: string;
  clientId: string;
  status: string;
  startTime: Date;
  cancellationReason: string | null;
  stylistUserId: string;
  stylistPhone: string;
  clientPhone: string;
  businessName: string;
  styleName: string;
};

export class NotificationsRepository {
  async getBookingContext(bookingId: string): Promise<BookingNotificationContext | null> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return null;

    const [stylistProfile, serviceOffering, stylistUser, clientUser] = await Promise.all([
      prisma.stylistProfile.findUnique({
        where: { id: booking.stylistId },
        select: { userId: true, businessName: true },
      }),
      prisma.serviceOffering.findUnique({
        where: { id: booking.serviceOfferingId ?? undefined },
        select: { styleName: true },
      }),
      prisma.stylistProfile
        .findUnique({ where: { id: booking.stylistId }, select: { userId: true } })
        .then((profile) =>
          profile
            ? prisma.user.findUnique({
                where: { id: profile.userId },
                select: { id: true, phoneNumber: true },
              })
            : null,
        ),
      booking.clientId
        ? prisma.user.findUnique({
            where: { id: booking.clientId },
            select: { id: true, phoneNumber: true },
          })
        : Promise.resolve(null),
    ]);

    if (!stylistProfile || !stylistUser) {
      return null;
    }

    if (!booking.clientId || !clientUser) {
      return null;
    }

    const styleName = serviceOffering?.styleName ?? 'Appointment';

    return {
      id: booking.id,
      stylistId: booking.stylistId,
      clientId: booking.clientId,
      status: booking.status,
      startTime: booking.startTime,
      cancellationReason: booking.cancellationReason,
      stylistUserId: stylistUser.id,
      stylistPhone: stylistUser.phoneNumber,
      clientPhone: clientUser.phoneNumber,
      businessName: stylistProfile.businessName || 'your stylist',
      styleName,
    };
  }

  async upsertScheduledNotification(input: {
    bookingId: string;
    recipientId: string;
    type: NotificationType;
    scheduledFor: Date | null;
  }): Promise<NotificationRecord> {
    const existing = await prisma.notification.findUnique({
      where: {
        bookingId_recipientId_type: {
          bookingId: input.bookingId,
          recipientId: input.recipientId,
          type: input.type,
        },
      },
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
      },
    });

    if (existing?.status === 'sent') {
      return existing;
    }

    const row = await prisma.notification.upsert({
      where: {
        bookingId_recipientId_type: {
          bookingId: input.bookingId,
          recipientId: input.recipientId,
          type: input.type,
        },
      },
      create: {
        bookingId: input.bookingId,
        recipientId: input.recipientId,
        type: input.type,
        status: 'scheduled',
        scheduledFor: input.scheduledFor,
      },
      update: {
        scheduledFor: input.scheduledFor,
        status: 'scheduled',
        failureReason: null,
      },
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
      },
    });
    return row;
  }

  async cancelPendingForBooking(bookingId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        bookingId,
        status: 'scheduled',
      },
      data: {
        status: 'cancelled',
      },
    });
    return result.count;
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    return prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
      },
    });
  }

  async markSent(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        failureReason: null,
      },
    });
  }

  async markSkipped(notificationId: string, reason: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'skipped',
        failureReason: reason,
      },
    });
  }

  async markFailed(notificationId: string, reason: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        failureReason: reason,
      },
    });
  }

  async deferNotification(notificationId: string, deferUntil: Date): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        scheduledFor: deferUntil,
      },
    });
  }

  async listDueNotifications(limit: number, now: Date = new Date()): Promise<NotificationRecord[]> {
    return prisma.notification.findMany({
      where: {
        status: 'scheduled',
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
      },
    });
  }

  async getSmsPreference(phoneNumber: string) {
    return prisma.smsPreference.findUnique({ where: { phoneNumber } });
  }

  async setAiOptOut(phoneNumber: string, optedOut: boolean): Promise<void> {
    const now = new Date();
    await prisma.smsPreference.upsert({
      where: { phoneNumber },
      create: {
        phoneNumber,
        aiOptedOut: optedOut,
        marketingOptedOut: optedOut,
        optedOutAt: optedOut ? now : null,
        optedInAt: optedOut ? null : now,
      },
      update: {
        aiOptedOut: optedOut,
        marketingOptedOut: optedOut,
        optedOutAt: optedOut ? now : undefined,
        optedInAt: optedOut ? null : now,
      },
    });
  }

  async hasActiveConversationRecently(input: {
    stylistId: string;
    clientId: string;
    withinMinutes: number;
  }): Promise<boolean> {
    const cutoff = new Date(Date.now() - input.withinMinutes * 60_000);
    const conversation = await prisma.conversation.findFirst({
      where: {
        stylistId: input.stylistId,
        clientId: input.clientId,
        channel: 'sms',
        status: 'active',
        lastMessageAt: { gte: cutoff },
      },
      select: { id: true },
    });
    return Boolean(conversation);
  }
}

export const notificationsRepository = new NotificationsRepository();
