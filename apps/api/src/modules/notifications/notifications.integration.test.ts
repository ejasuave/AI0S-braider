import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../lib/db.js';
import { notificationsService } from './service.js';
import { notificationsRepository } from './repository.js';
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

let databaseAvailable = false;

describe('notifications compliance', () => {
  const sms = new CapturingSmsProvider();

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    setSmsProvider(sms);
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    sms.sent.length = 0;
    await prisma.notification.deleteMany();
    await prisma.smsPreference.deleteMany();
    await prisma.message.deleteMany();
    await prisma.escalation.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceOffering.deleteMany();
    await prisma.stylistProfile.deleteMany();
    await prisma.user.deleteMany({
      where: { phoneNumber: { in: [clientPhone, stylistPhone] } },
    });
  });

  it.skipIf(!databaseAvailable)(
    'STOP halts AI opt-out but still delivers transactional notifications',
    async () => {
      const stylistUser = await prisma.user.create({
        data: {
          role: 'stylist_owner',
          phoneNumber: stylistPhone,
          email: 'notif-stylist@example.com',
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
      const stylistProfile = await prisma.stylistProfile.create({
        data: {
          userId: stylistUser.id,
          businessName: 'Test Braids',
          smsBookingNumber: '+447700900599',
        },
      });
      const offering = await prisma.serviceOffering.create({
        data: {
          stylistId: stylistProfile.id,
          styleName: 'Box braids',
          basePrice: 120,
          estimatedDurationMinutes: 180,
        },
      });
      const booking = await prisma.booking.create({
        data: {
          stylistId: stylistProfile.id,
          clientId: clientUser.id,
          serviceOfferingId: offering.id,
          status: 'confirmed',
          startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          agreedPrice: 120,
          agreedDurationMinutes: 180,
          depositAmount: 30,
          depositStatus: 'paid',
          source: 'client_direct',
        },
      });

      await notificationsService.handleStopKeyword(clientPhone);
      expect(await notificationsService.isAiOptedOut(clientPhone)).toBe(true);

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
    },
  );

  it.skipIf(!databaseAvailable)(
    'skips reminder delivery when booking was cancelled before send',
    async () => {
      const stylistUser = await prisma.user.create({
        data: {
          role: 'stylist_owner',
          phoneNumber: stylistPhone,
          email: 'notif-stylist2@example.com',
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
      const stylistProfile = await prisma.stylistProfile.create({
        data: {
          userId: stylistUser.id,
          businessName: 'Test Braids',
          smsBookingNumber: '+447700900599',
        },
      });
      const offering = await prisma.serviceOffering.create({
        data: {
          stylistId: stylistProfile.id,
          styleName: 'Box braids',
          basePrice: 120,
          estimatedDurationMinutes: 180,
        },
      });
      const booking = await prisma.booking.create({
        data: {
          stylistId: stylistProfile.id,
          clientId: clientUser.id,
          serviceOfferingId: offering.id,
          status: 'cancelled',
          startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
          agreedPrice: 120,
          agreedDurationMinutes: 180,
          depositAmount: 30,
          depositStatus: 'paid',
          source: 'client_direct',
          cancelledAt: new Date(),
        },
      });

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
    },
  );
});

describe('twilio STOP webhook', () => {
  it.skipIf(!databaseAvailable)('records opt-out without invoking receptionist', async () => {
    const app = await buildApp();
    const clientUser = await prisma.user.create({
      data: {
        role: 'client',
        phoneNumber: clientPhone,
        phoneVerifiedAt: new Date(),
      },
    });
    const stylistUser = await prisma.user.create({
      data: {
        role: 'stylist_owner',
        phoneNumber: stylistPhone,
        email: 'stop-webhook@example.com',
        passwordHash: 'hash',
        phoneVerifiedAt: new Date(),
      },
    });
    await prisma.stylistProfile.create({
      data: {
        userId: stylistUser.id,
        businessName: 'Webhook Braids',
        smsBookingNumber: '+447700900599',
      },
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
    expect(await notificationsService.isAiOptedOut(clientPhone)).toBe(true);
    expect(await prisma.conversation.count({ where: { clientId: clientUser.id } })).toBe(0);
  });
});
