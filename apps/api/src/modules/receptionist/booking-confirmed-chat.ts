import type { Prisma } from '@prisma/client';
import { onBookingConfirmed } from '../../lib/domain-events.js';
import { prisma } from '../../lib/db.js';
import { getEnv } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { formatSlotLabel } from '../../lib/scheduling/format-datetime.js';
import { messagingService } from '../messaging/service.js';
import { messagingRepository } from '../messaging/repository.js';

const log = createLogger().child({ module: 'receptionist-booking-confirmed-chat' });

const BOOKING_CONFIRMED_META_KEY = 'booking_confirmed_for';

async function alreadyPostedConfirmation(
  conversationId: string,
  bookingId: string,
): Promise<boolean> {
  const existing = await prisma.message.findFirst({
    where: {
      conversationId,
      structuredOutput: {
        path: [BOOKING_CONFIRMED_META_KEY],
        equals: bookingId,
      },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function findConversationForBooking(input: {
  stylistId: string;
  clientId: string;
}): Promise<{ id: string } | null> {
  const web = await messagingRepository.findOpenConversation(
    input.stylistId,
    input.clientId,
    'web',
  );
  if (web) return web;

  const sms = await messagingRepository.findOpenConversation(
    input.stylistId,
    input.clientId,
    'sms',
  );
  if (sms) return sms;

  return prisma.conversation.findFirst({
    where: {
      stylistId: input.stylistId,
      clientId: input.clientId,
      status: { in: ['active', 'escalated', 'resolved'] },
    },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true },
  });
}

export async function postAiBookingConfirmedMessage(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.source !== 'ai_agent' || !booking.clientId) {
    return;
  }
  if (booking.status !== 'confirmed') {
    return;
  }

  const conversation = await findConversationForBooking({
    stylistId: booking.stylistId,
    clientId: booking.clientId,
  });
  if (!conversation) {
    return;
  }

  if (await alreadyPostedConfirmation(conversation.id, booking.id)) {
    return;
  }

  const env = getEnv();
  const when = formatSlotLabel(booking.startTime.toISOString(), env.PLATFORM_TIMEZONE);
  const bookingUrl = `${env.WEB_APP_URL}/client/bookings/${booking.id}`;
  const content = `You're booked for ${when}. See your booking: ${bookingUrl}`;

  await messagingService.sendOutboundMessage({
    conversationId: conversation.id,
    sender: 'system',
    content,
    structuredOutput: {
      [BOOKING_CONFIRMED_META_KEY]: booking.id,
      next_action: 'noop',
      intent: 'general',
      confidence: 1,
      client_message: content,
      extracted_slots: {
        bookingId: booking.id,
        bookingStatus: 'confirmed',
      },
    } as Prisma.InputJsonValue,
  });
}

onBookingConfirmed(async ({ bookingId }) => {
  try {
    await postAiBookingConfirmedMessage(bookingId);
  } catch (error) {
    log.warn({ err: error, bookingId }, 'Failed to post AI booking confirmation into chat');
  }
});
