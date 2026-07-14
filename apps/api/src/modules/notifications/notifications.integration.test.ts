import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { notificationsService } from './service.js';
import { notificationsRepository } from './repository.js';
import { clientPreferencesService } from '../client-preferences/service.js';
import { clientPreferencesRepository } from '../client-preferences/repository.js';
import { setSmsProvider } from '../../lib/sms/sms-provider.js';
import type { SmsProvider } from '../../lib/sms/sms-provider.types.js';

class CapturingSmsProvider implements SmsProvider {
  readonly sent: Array<{ to: string; body: string; from?: string }> = [];

  async send(message: { to: string; body: string; from?: string }) {
    this.sent.push(message);
    return { providerMessageId: `test-${this.sent.length}` };
  }
}

const clientPhone = '+447700900501';
const stylistPhone = '+447700900502';

const sms = new CapturingSmsProvider();

let databaseAvailable = false;

async function seedBookingFixture(input?: {
  status?: 'confirmed' | 'cancelled';
  startOffsetMs?: number;
}) {
  const stylistUser = await prisma.user.create({
    data: {
      role: 'stylist_owner',
      phoneNumber: stylistPhone,
      email: `notif-stylist-${Date.now()}@example.com`,
      passwordHash: 'hash',
      phoneVerifiedAt: new Date(),
    },
  });
  const clientUser = await prisma.user.create({
    data: {
      role: 'client',
      phoneNumber: clientPhone,
      phoneVerifiedAt: new Date(),
    },
  });
  const business = await prisma.business.create({
    data: { ownerUserId: stylistUser.id, businessName: 'Test Braids' },
  });
  const stylistProfile = await prisma.stylistProfile.create({
    data: {
      userId: stylistUser.id,
      businessId: business.id,
      businessName: 'Test Braids',
      smsBookingNumber: '+447700900599',
    },
  });
  const offering = await prisma.serviceOffering.create({
    data: {
      businessId: business.id,
      stylistId: stylistProfile.id,
      styleName: 'Box braids',
      basePrice: 120,
      estimatedDurationMinutes: 180,
    },
  });
  const startTime = new Date(Date.now() + (input?.startOffsetMs ?? 3 * 24 * 60 * 60 * 1000));
  const booking = await prisma.booking.create({
    data: {
      stylistId: stylistProfile.id,
      clientId: clientUser.id,
      serviceOfferingId: offering.id,
      status: input?.status ?? 'confirmed',
      startTime,
      endTime: new Date(startTime.getTime() + 3 * 60 * 60 * 1000),
      agreedPrice: 120,
      agreedDurationMinutes: 180,
      depositAmount: 30,
      depositStatus: 'paid',
      source: 'client_direct',
      cancelledAt: input?.status === 'cancelled' ? new Date() : null,
    },
  });

  return { stylistUser, clientUser, stylistProfile, booking };
}

describe('notifications integration', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    setSmsProvider(sms);
  });

  describe('notifications compliance', () => {
    afterEach(async () => {
      if (!databaseAvailable) return;
      sms.sent.length = 0;
      await prisma.notification.deleteMany();
      await prisma.optOutAuditLog.deleteMany();
      await prisma.notificationPreference.deleteMany();
      await prisma.smsPreference.deleteMany();
      await prisma.message.deleteMany();
      await prisma.escalation.deleteMany();
      await prisma.conversation.deleteMany();
      await prisma.booking.deleteMany();
      await prisma.serviceOffering.deleteMany();
      await prisma.stylistProfile.deleteMany();
      await prisma.business.deleteMany();
      await prisma.user.deleteMany({
        where: { phoneNumber: { in: [clientPhone, stylistPhone] } },
      });
    });

    it('STOP halts AI but still delivers transactional notifications (Blueprint)', async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();
      const { clientUser, booking } = await seedBookingFixture();

      await clientPreferencesService.handleStopKeyword(clientPhone);
      expect(await clientPreferencesService.isAiOptedOut(clientPhone)).toBe(true);

      const notification = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'confirmation',
        scheduledFor: new Date(),
      });

      const result = await notificationsService.deliverNotification(notification.id);
      expect(result.delivered).toBe(true);

      const row = await prisma.notification.findUnique({ where: { id: notification.id } });
      expect(row?.status).toBe('sent');
    });

    it('skips reminder when appointment_reminders_enabled is false', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { clientUser, booking } = await seedBookingFixture();

      await clientPreferencesRepository.updatePreferences(clientUser.id, {
        appointmentRemindersEnabled: false,
      });

      const notification = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'reminder_2h',
        scheduledFor: new Date(),
      });

      const result = await notificationsService.deliverNotification(notification.id);
      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('appointment_reminders_disabled');

      const row = await prisma.notification.findUnique({ where: { id: notification.id } });
      expect(row?.status).toBe('skipped');
      expect(row?.skipReason).toBe('appointment_reminders_disabled');
    });

    it('delivers confirmation even when marketing_messages_enabled is false', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { clientUser, booking } = await seedBookingFixture();

      await clientPreferencesRepository.updatePreferences(clientUser.id, {
        marketingMessagesEnabled: false,
      });

      const notification = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'confirmation',
        scheduledFor: new Date(),
      });

      const result = await notificationsService.deliverNotification(notification.id);
      expect(result.delivered).toBe(true);
    });

    it('skips reminder delivery when booking was cancelled before send', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { clientUser, booking } = await seedBookingFixture({ status: 'cancelled' });

      const notification = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'reminder_2h',
        scheduledFor: new Date(),
      });

      const result = await notificationsService.deliverNotification(notification.id);
      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('booking_not_confirmed');

      const row = await prisma.notification.findUnique({ where: { id: notification.id } });
      expect(row?.status).toBe('skipped');
      expect(row?.skipReason).toBe('booking_not_confirmed');
    });

    it('schedules both reminders on confirmation with sufficient lead time', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { booking } = await seedBookingFixture({ startOffsetMs: 4 * 24 * 60 * 60 * 1000 });

      await notificationsService.onBookingConfirmed(booking.id);

      const reminders = await prisma.notification.findMany({
        where: { bookingId: booking.id, type: { in: ['reminder_48h', 'reminder_2h'] } },
      });
      expect(reminders).toHaveLength(2);
    });

    it('skips reminder rows when lead time is under 2 hours', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { booking } = await seedBookingFixture({ startOffsetMs: 90 * 60 * 1000 });

      await notificationsService.onBookingConfirmed(booking.id);

      const reminders = await prisma.notification.findMany({
        where: { bookingId: booking.id, type: { in: ['reminder_48h', 'reminder_2h'] } },
      });
      expect(reminders).toHaveLength(0);
    });

    it('cancels pending reminders when booking is cancelled', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { booking } = await seedBookingFixture({ startOffsetMs: 4 * 24 * 60 * 60 * 1000 });
      await notificationsService.onBookingConfirmed(booking.id);

      await notificationsService.onBookingCancelled(booking.id, 'full_refund');

      const pending = await prisma.notification.findMany({
        where: {
          bookingId: booking.id,
          type: { in: ['reminder_48h', 'reminder_2h'] },
          status: 'scheduled',
        },
      });
      expect(pending).toHaveLength(0);
    });

    it('creates dual confirmation notifications on booking confirmed', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { stylistUser, clientUser, booking } = await seedBookingFixture();

      await notificationsService.onBookingConfirmed(booking.id);

      const rows = await prisma.notification.findMany({
        where: { bookingId: booking.id, type: 'confirmation' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.recipientId).sort()).toEqual(
        [clientUser.id, stylistUser.id].sort(),
      );
    });

    it('no-show notice is stylist-only', async ({ skip }) => {
      if (!databaseAvailable) skip();
      const { stylistUser, clientUser, booking } = await seedBookingFixture();

      await notificationsService.onBookingNoShow(booking.id, 'forfeit_deposit');

      const rows = await prisma.notification.findMany({
        where: { bookingId: booking.id, type: 'no_show_notice' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.recipientId).toBe(stylistUser.id);
      expect(rows.map((row) => row.recipientId)).not.toContain(clientUser.id);
    });

    it('START restores reminder delivery after appointment reminders re-enabled', async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();
      const { clientUser, booking } = await seedBookingFixture();

      await clientPreferencesService.handleStopKeyword(clientPhone);
      await clientPreferencesRepository.updatePreferences(clientUser.id, {
        appointmentRemindersEnabled: false,
      });

      const skipped = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'reminder_2h',
        scheduledFor: new Date(),
      });
      expect((await notificationsService.deliverNotification(skipped.id)).delivered).toBe(false);

      await clientPreferencesService.handleStartKeyword(clientPhone);
      await clientPreferencesRepository.updatePreferences(clientUser.id, {
        appointmentRemindersEnabled: true,
      });

      const restored = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'reminder_48h',
        scheduledFor: new Date(),
      });
      const result = await notificationsService.deliverNotification(restored.id);
      expect(result.delivered).toBe(true);
    });
  });

  describe('twilio STOP webhook e2e', () => {
    it('records opt-out via Ch.11 → Ch.5 → skips future reminders when disabled in profile', async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();
      const app = await buildApp();
      const { clientUser, booking } = await seedBookingFixture();

      await clientPreferencesRepository.updatePreferences(clientUser.id, {
        appointmentRemindersEnabled: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/twilio/sms',
        payload: {
          MessageSid: 'SM-stop-test-1',
          From: clientPhone,
          To: '+447700900599',
          Body: 'STOP',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(await clientPreferencesService.isAiOptedOut(clientPhone)).toBe(true);

      const audit = await prisma.optOutAuditLog.findFirst({
        where: { phoneNumber: clientPhone, action: 'opt_out' },
      });
      expect(audit?.keyword).toBe('STOP');

      const notification = await notificationsRepository.upsertScheduledNotification({
        bookingId: booking.id,
        recipientId: clientUser.id,
        type: 'reminder_2h',
        scheduledFor: new Date(),
      });

      const delivery = await notificationsService.deliverNotification(notification.id);
      expect(delivery.delivered).toBe(false);
      expect(delivery.reason).toBe('appointment_reminders_disabled');
    });
  });
});
