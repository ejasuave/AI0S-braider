import type { DepositDisposition } from '@project-braids/shared-types/api';
import type { NotificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { clientPreferencesRepository } from '../client-preferences/repository.js';
import { parseAddonsSnapshot } from '../booking/mappers.js';

export type NotificationRecord = {
  id: string;
  bookingId: string | null;
  recipientId: string;
  type: NotificationType;
  status: NotificationStatus;
  scheduledFor: Date | null;
  depositDisposition: string | null;
};

export type BookingNotificationContext = {
  id: string;
  stylistId: string;
  clientId: string;
  status: string;
  startTime: Date;
  cancellationReason: string | null;
  depositAmount: number | null;
  depositStatus: string;
  stylistUserId: string;
  stylistPhone: string;
  clientPhone: string;
  businessName: string;
  styleName: string;
  serviceVenueMode: 'remote' | 'stylist_location' | 'come_to_client';
  venueAddress: string | null;
  clientDisplayName: string | null;
  addonNames: string[];
  remainingBalanceMethod: 'cash' | 'card' | 'cash_or_card' | null;
  balanceAmount: number | null;
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
    const addons = parseAddonsSnapshot(booking.addonsSnapshot);
    const depositAmount = booking.depositAmount ? Number(booking.depositAmount) : null;
    const agreedPrice = Number(booking.agreedPrice);
    const balanceAmount =
      depositAmount != null
        ? Math.max(0, Math.round((agreedPrice - depositAmount) * 100) / 100)
        : null;

    return {
      id: booking.id,
      stylistId: booking.stylistId,
      clientId: booking.clientId,
      status: booking.status,
      startTime: booking.startTime,
      cancellationReason: booking.cancellationReason,
      depositAmount,
      depositStatus: booking.depositStatus,
      stylistUserId: stylistUser.id,
      stylistPhone: stylistUser.phoneNumber,
      clientPhone: clientUser.phoneNumber,
      businessName: stylistProfile.businessName || 'your stylist',
      styleName,
      serviceVenueMode: booking.serviceVenueMode,
      venueAddress: booking.venueAddress,
      clientDisplayName: booking.clientDisplayName,
      addonNames: addons.map((addon) => addon.name),
      remainingBalanceMethod: booking.remainingBalanceMethod,
      balanceAmount,
    };
  }

  async upsertScheduledNotification(input: {
    bookingId: string;
    recipientId: string;
    type: NotificationType;
    scheduledFor: Date | null;
    depositDisposition?: DepositDisposition | null;
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
        depositDisposition: true,
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
        depositDisposition: input.depositDisposition ?? null,
      },
      update: {
        scheduledFor: input.scheduledFor,
        status: 'scheduled',
        failureReason: null,
        skipReason: null,
        depositDisposition: input.depositDisposition ?? undefined,
      },
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
        depositDisposition: true,
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
        depositDisposition: true,
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
        skipReason: null,
      },
    });
  }

  async markSkipped(notificationId: string, reason: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'skipped',
        skipReason: reason,
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
        depositDisposition: true,
      },
    });
  }

  async getRecipientPreferences(recipientId: string) {
    return clientPreferencesRepository.getPreferencesForRecipient(recipientId);
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

  async listScheduledRemindersForBooking(bookingId: string): Promise<NotificationRecord[]> {
    return prisma.notification.findMany({
      where: {
        bookingId,
        type: { in: ['reminder_48h', 'reminder_2h'] },
        status: { in: ['scheduled', 'cancelled'] },
      },
      select: {
        id: true,
        bookingId: true,
        recipientId: true,
        type: true,
        status: true,
        scheduledFor: true,
        depositDisposition: true,
      },
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
