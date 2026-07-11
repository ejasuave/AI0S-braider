import type { Prisma } from '@prisma/client';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { bookingService } from '../booking/service.js';
import { messagingService } from '../messaging/service.js';
import { paymentService } from '../payments/service.js';
import { profileService } from '../profile/service.js';
import { formatSlotLabel } from '../../lib/scheduling/format-datetime.js';
import { attachStructuredMetadata, type ConversationTurnContext } from './context.js';

export type DispatchResult = {
  output: ReceptionistTurnOutput;
  sentMessage: string;
};

type SlotState = ReceptionistTurnOutput['extracted_slots'] & {
  serviceOfferingId?: string;
  bookingId?: string;
};

async function resolveServiceOfferingId(
  stylistId: string,
  slots: SlotState,
): Promise<string | undefined> {
  if (slots.serviceOfferingId) {
    return slots.serviceOfferingId;
  }
  if (!slots.styleName) {
    return undefined;
  }
  const pricing = await profileService.lookupPricing(stylistId, {
    styleName: slots.styleName,
    sizeTier: slots.sizeTier,
    lengthTier: slots.lengthTier,
  });
  if (pricing.offering) {
    slots.serviceOfferingId = pricing.offering.id;
    return pricing.offering.id;
  }
  return undefined;
}

async function buildProposedSlotsMessage(
  context: ConversationTurnContext,
  output: ReceptionistTurnOutput,
  slots: SlotState,
  introMessage: string,
): Promise<{ clientMessage: string; metadata: Record<string, unknown>; output: ReceptionistTurnOutput }> {
  const serviceOfferingId = await resolveServiceOfferingId(context.stylistId, slots);
  if (!serviceOfferingId) {
    throw ApiError.validation('serviceOfferingId required to propose slots');
  }

  const from = slots.preferredDate
    ? new Date(`${slots.preferredDate}T00:00:00.000Z`)
    : new Date();
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  const availability = await bookingService.getAvailability({
    stylistId: context.stylistId,
    serviceOfferingId,
    from: from.toISOString(),
    to: to.toISOString(),
    limit: 3,
  });

  if (availability.slots.length === 0) {
    return {
      clientMessage:
        "I couldn't find open slots in the next week. What other days work for you?",
      metadata: {},
      output: { ...output, next_action: 'ask_clarification' },
    };
  }

  const proposed = availability.slots.slice(0, 3).map((slot, index) => ({
    index: index + 1,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));

  const lines = proposed.map(
    (slot, index) => `${index + 1}. ${formatSlotLabel(slot.startTime, availability.timezone)}`,
  );
  return {
    clientMessage: `${introMessage}\n\n${lines.join('\n')}\n\nReply with the number of your preferred slot.`,
    metadata: { proposed_slots: proposed },
    output: { ...output, next_action: 'propose_slots' },
  };
}

function isSlotUnavailableError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.statusCode === 409 &&
    /not available|no longer available/i.test(error.message)
  );
}

export async function dispatchReceptionistTurn(
  context: ConversationTurnContext,
  output: ReceptionistTurnOutput,
): Promise<DispatchResult> {
  const env = getEnv();
  let clientMessage = output.client_message;
  let metadata: Record<string, unknown> = {};
  const slots: SlotState = { ...context.mergedSlots, ...output.extracted_slots };

  switch (output.next_action) {
    case 'confirm_style_price': {
      if (!slots.styleName) {
        throw ApiError.validation('Style name required for price confirmation');
      }
      const pricing = await profileService.lookupPricing(context.stylistId, {
        styleName: slots.styleName,
        sizeTier: slots.sizeTier,
        lengthTier: slots.lengthTier,
      });
      if (!pricing.offering) {
        output = {
          ...output,
          next_action: 'escalate',
          escalation_reason: 'No matching priced service',
          client_message:
            "I want to make sure we quote you correctly — I'm passing this to the stylist.",
        };
        break;
      }
      slots.serviceOfferingId = pricing.offering.id;
      clientMessage = `${output.client_message}\n\n${pricing.offering.styleName}: £${pricing.offering.basePrice}, about ${pricing.offering.estimatedDurationMinutes} mins.`;
      metadata = { pricing_lookup: pricing };
      break;
    }

    case 'propose_slots': {
      const proposed = await buildProposedSlotsMessage(
        context,
        output,
        slots,
        output.client_message,
      );
      clientMessage = proposed.clientMessage;
      metadata = proposed.metadata;
      output = proposed.output;
      break;
    }

    case 'create_hold': {
      let startTime = slots.selectedSlotStart;
      if (!startTime && slots.selectedSlotIndex && context.proposedSlots.length > 0) {
        const chosen = context.proposedSlots.find((slot) => slot.index === slots.selectedSlotIndex);
        startTime = chosen?.startTime;
      }
      if (!slots.serviceOfferingId || !startTime) {
        throw ApiError.validation('serviceOfferingId and selected slot required to create hold');
      }

      try {
        const booking = await bookingService.createHold(context.clientId, {
          stylistId: context.stylistId,
          serviceOfferingId: slots.serviceOfferingId,
          startTime,
          source: 'ai_agent',
        });

        slots.bookingId = booking.id;
        clientMessage = `${output.client_message}\n\nI've reserved ${formatSlotLabel(booking.startTime, env.PLATFORM_TIMEZONE)}.`;
        metadata = { booking_id: booking.id };
        output = { ...output, extracted_slots: slots };

        const payment = await paymentService.createDepositPayment(context.clientId, booking.id);
        const depositUrl = `${env.WEB_APP_URL}/client/bookings/${booking.id}`;
        const cancellationNote = context.stylistContext.cancellationPolicy
          ? ` Cancellation policy applies — see your booking page.`
          : '';
        clientMessage = `${clientMessage}\n\nPay your £${payment.amount} deposit here: ${depositUrl}.${cancellationNote}`;
        metadata = { ...metadata, payment_id: payment.id };
        output = { ...output, next_action: 'send_deposit_link' };
      } catch (error) {
        if (!isSlotUnavailableError(error)) {
          throw error;
        }

        const reoffer = await buildProposedSlotsMessage(
          context,
          output,
          slots,
          "Sorry — that slot was just taken. Here are the next available times:",
        );
        clientMessage = reoffer.clientMessage;
        metadata = reoffer.metadata;
        output = reoffer.output;
      }
      break;
    }

    case 'send_deposit_link': {
      const bookingId = slots.bookingId ?? context.pendingBookingId;
      if (!bookingId) {
        throw ApiError.validation('bookingId required to send deposit link');
      }

      const payment = await paymentService.createDepositPayment(context.clientId, bookingId);
      const depositUrl = `${env.WEB_APP_URL}/client/bookings/${bookingId}`;
      clientMessage = `${output.client_message}\n\nPay your £${payment.amount} deposit here: ${depositUrl}`;
      metadata = { booking_id: bookingId, payment_id: payment.id };
      break;
    }

    case 'ask_clarification':
    case 'answer_faq':
    case 'noop':
      break;

    case 'escalate':
      break;

    default:
      break;
  }

  const structured = attachStructuredMetadata(
    {
      ...output,
      extracted_slots: slots,
      client_message: clientMessage,
    },
    metadata,
  );

  await messagingService.sendOutboundMessage({
    conversationId: context.conversationId,
    sender: 'ai',
    content: clientMessage,
    structuredOutput: structured as unknown as Prisma.InputJsonValue,
  });

  return { output: structured, sentMessage: clientMessage };
}
