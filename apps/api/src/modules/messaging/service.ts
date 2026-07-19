import type {
  ConversationChannel,
  MessageDeliveryStatus,
  MessageSender,
  Prisma,
} from '@prisma/client';
import type {
  ConversationDetail,
  ConversationListQuery,
  ConversationListResponse,
  InboundSmsResult,
  StylistSmsBookingNumber,
} from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { assertInboundMessagingAllowed } from '../../lib/messaging-rate-limit.js';
import { isValidE164Phone, normalizePhoneNumber } from '../../lib/phone.js';
import { getSmsProvider } from '../../lib/sms/sms-provider.js';
import { identityService } from '../identity/service.js';
import { emitConversationEscalated, emitConversationMessage } from '../../lib/domain-events.js';
import { toConversationDetail, toConversationSummary } from './mappers.js';
import { messagingRepository } from './repository.js';

const ACTIVE_STATUSES = new Set(['active', 'escalated']);

const TWILIO_STATUS_MAP: Record<string, MessageDeliveryStatus> = {
  queued: 'pending',
  sending: 'pending',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  undelivered: 'undelivered',
};

export class MessagingService {
  /** Prompt 11.1 — single outbound write path for all channels and senders. */
  async sendMessage(input: {
    conversationId: string;
    sender: MessageSender;
    content: string;
    structuredOutput?: Prisma.InputJsonValue;
    stylistId?: string;
  }): Promise<{ messageId: string; providerMessageId?: string }> {
    return this.sendOutboundMessage(input);
  }

  /** Prompt 11.1 — single inbound client write path; resolves or creates the conversation. */
  async receiveMessage(input: {
    stylistId: string;
    clientId: string;
    channel: ConversationChannel;
    content: string;
    providerMessageId?: string;
  }): Promise<InboundSmsResult> {
    if (input.providerMessageId) {
      const existing = await messagingRepository.findMessageByProviderId(input.providerMessageId);
      if (existing) {
        return {
          conversationId: existing.conversationId,
          messageId: existing.id,
          duplicate: true,
        };
      }
    }

    let conversation = await messagingRepository.findOpenConversation(
      input.stylistId,
      input.clientId,
      input.channel,
    );

    if (!conversation) {
      conversation = await messagingRepository.createConversation({
        stylistId: input.stylistId,
        clientId: input.clientId,
        channel: input.channel,
      });
    }

    const message = await messagingRepository.appendMessage({
      conversationId: conversation.id,
      sender: 'client',
      content: input.content.trim(),
      providerMessageId: input.providerMessageId,
    });

    if (conversation.status === 'escalated') {
      void emitConversationMessage({
        conversationId: conversation.id,
        stylistId: input.stylistId,
        messageId: message.id,
      }).catch(() => {});
    }

    return {
      conversationId: conversation.id,
      messageId: message.id,
      duplicate: false,
    };
  }

  /** Prompt 11.5 — documented handoff check for Chapter 13. */
  async isEscalated(conversationId: string): Promise<boolean> {
    const conversation = await messagingRepository.getConversationById(conversationId);
    return conversation?.status === 'escalated';
  }

  async getBookingNumber(stylistId: string): Promise<StylistSmsBookingNumber> {
    const number = await messagingRepository.getStylistSmsNumber(stylistId);
    return { smsBookingNumber: number };
  }

  async setBookingNumber(
    stylistId: string,
    smsBookingNumber: string,
  ): Promise<StylistSmsBookingNumber> {
    const normalized = normalizePhoneNumber(smsBookingNumber);
    if (!isValidE164Phone(normalized)) {
      throw ApiError.validation('Invalid E.164 phone number');
    }

    const existing = await messagingRepository.findStylistBySmsNumber(normalized);
    if (existing && existing.id !== stylistId) {
      throw new ApiError('CONFLICT', 'SMS booking number is already assigned', 409);
    }

    const updated = await messagingRepository.setStylistSmsNumber(stylistId, normalized);
    return { smsBookingNumber: updated.smsBookingNumber };
  }

  async listConversations(
    stylistId: string,
    query: ConversationListQuery,
  ): Promise<ConversationListResponse> {
    const { rows, total } = await messagingRepository.listConversationsForStylist(stylistId, {
      status: query.status,
      escalatedOnly: query.escalatedOnly,
      limit: query.limit,
      offset: query.offset,
    });

    const items = [];
    for (const row of rows) {
      const phone = await messagingRepository.getClientPhoneNumber(row.clientId);
      if (!phone) continue;
      items.push(toConversationSummary(row, { clientPhoneNumber: phone }));
    }

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async listClientConversations(
    clientId: string,
    query: Pick<ConversationListQuery, 'limit' | 'offset'>,
  ): Promise<ConversationListResponse> {
    const { rows, total } = await messagingRepository.listConversationsForClient(clientId, {
      limit: query.limit,
      offset: query.offset,
    });

    const items = rows.map((row) =>
      toConversationSummary(row, {
        stylistBusinessName: row.stylist?.businessName ?? 'Stylist',
        smsBookingNumber: row.stylist?.smsBookingNumber ?? null,
      }),
    );

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async getConversation(stylistId: string, conversationId: string): Promise<ConversationDetail> {
    const conversation = await messagingRepository.getConversationForStylist(
      stylistId,
      conversationId,
    );
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const phone = await messagingRepository.getClientPhoneNumber(conversation.clientId);
    if (!phone) {
      throw ApiError.notFound('Client not found');
    }

    return toConversationDetail(
      {
        ...conversation,
        messages: conversation.messages ?? [],
        escalations: conversation.escalations ?? [],
      },
      { clientPhoneNumber: phone },
    );
  }

  async getClientConversation(
    clientId: string,
    conversationId: string,
  ): Promise<ConversationDetail> {
    const conversation = await messagingRepository.getConversationForClient(
      clientId,
      conversationId,
    );
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    return toConversationDetail(
      {
        ...conversation,
        messages: conversation.messages ?? [],
        escalations: conversation.escalations ?? [],
      },
      {
        stylistBusinessName: conversation.stylist?.businessName ?? 'Stylist',
        smsBookingNumber: conversation.stylist?.smsBookingNumber ?? null,
      },
    );
  }

  async handleInboundSms(input: {
    from: string;
    to: string;
    body: string;
    providerMessageId: string;
  }): Promise<InboundSmsResult> {
    const from = normalizePhoneNumber(input.from);
    const to = normalizePhoneNumber(input.to);

    if (!isValidE164Phone(from) || !isValidE164Phone(to)) {
      throw ApiError.validation('Invalid phone number in SMS payload');
    }

    await assertInboundMessagingAllowed(from);

    const stylist = await messagingRepository.findStylistBySmsNumber(to);
    if (!stylist) {
      throw ApiError.notFound('No stylist is configured for this SMS number');
    }

    const { userId: clientId } = await identityService.findOrCreateClientByPhone(from);

    return this.receiveMessage({
      stylistId: stylist.id,
      clientId,
      channel: 'sms',
      content: input.body,
      providerMessageId: input.providerMessageId,
    });
  }

  async sendOutboundMessage(input: {
    conversationId: string;
    sender: MessageSender;
    content: string;
    structuredOutput?: Prisma.InputJsonValue;
    stylistId?: string;
  }): Promise<{ messageId: string; providerMessageId?: string }> {
    const conversation = input.stylistId
      ? await messagingRepository.getConversationForStylist(input.stylistId, input.conversationId)
      : await messagingRepository.getConversationById(input.conversationId);

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    if (input.sender === 'stylist' && conversation.status !== 'escalated') {
      throw new ApiError(
        'FORBIDDEN',
        'Stylist can only reply while a conversation is escalated',
        403,
      );
    }

    if (input.sender === 'ai' && conversation.status === 'escalated') {
      throw new ApiError('FORBIDDEN', 'AI cannot reply while a human stylist has taken over', 403);
    }

    const isOutboundToClient = input.sender !== 'client';
    const message = await messagingRepository.appendMessage({
      conversationId: conversation.id,
      sender: input.sender,
      content: input.content,
      structuredOutput: input.structuredOutput,
      deliveryStatus: isOutboundToClient && conversation.channel === 'sms' ? 'pending' : undefined,
    });

    if (conversation.channel === 'sms' && isOutboundToClient) {
      const clientPhone = await messagingRepository.getClientPhoneNumber(conversation.clientId);
      const fromNumber = await messagingRepository.getStylistSmsNumber(conversation.stylistId);
      const env = getEnv();

      if (!clientPhone) {
        throw ApiError.internal('Client phone number missing');
      }

      const sendResult = await getSmsProvider().send({
        to: clientPhone,
        from: fromNumber ?? env.TWILIO_PHONE_NUMBER,
        body: input.content,
      });

      if (sendResult.providerMessageId) {
        await messagingRepository.attachOutboundProviderMessage(
          message.id,
          sendResult.providerMessageId,
          'sent',
        );
      }

      return { messageId: message.id, providerMessageId: sendResult.providerMessageId };
    }

    return { messageId: message.id };
  }

  async sendDirectSms(input: {
    to: string;
    body: string;
    from?: string;
  }): Promise<{ providerMessageId?: string }> {
    const env = getEnv();
    const sendResult = await getSmsProvider().send({
      to: input.to,
      from: input.from ?? env.TWILIO_PHONE_NUMBER,
      body: input.body,
    });
    return { providerMessageId: sendResult.providerMessageId };
  }

  async updateSmsDeliveryStatus(input: {
    providerMessageId: string;
    twilioStatus: string;
  }): Promise<boolean> {
    const mapped = TWILIO_STATUS_MAP[input.twilioStatus.toLowerCase()];
    if (!mapped) return false;
    const updated = await messagingRepository.updateMessageDeliveryStatus(
      input.providerMessageId,
      mapped,
    );
    return updated !== null;
  }

  async escalateConversation(
    stylistId: string,
    conversationId: string,
    reason: string,
  ): Promise<ConversationDetail> {
    const conversation = await messagingRepository.getConversationForStylist(
      stylistId,
      conversationId,
    );
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    if (conversation.status === 'escalated') {
      throw new ApiError('CONFLICT', 'Conversation is already escalated', 409);
    }

    if (!ACTIVE_STATUSES.has(conversation.status)) {
      throw new ApiError('CONFLICT', 'Conversation is not open', 409);
    }

    await messagingRepository.escalateConversation({ conversationId, reason });
    void emitConversationEscalated({ conversationId, stylistId, reason }).catch(() => {});
    await this.notifyStylistOfEscalation(stylistId, reason);

    await this.sendOutboundMessage({
      conversationId,
      stylistId,
      sender: 'system',
      content:
        'A stylist will reply to you shortly. Please hold on — your message is important to us.',
    });

    return this.getConversation(stylistId, conversationId);
  }

  private async notifyStylistOfEscalation(stylistId: string, reason: string): Promise<void> {
    const env = getEnv();
    const stylistPhone = await messagingRepository.getStylistOwnerPhone(stylistId);
    if (!stylistPhone) return;

    await this.sendDirectSms({
      to: stylistPhone,
      body: `${env.PLATFORM_DISPLAY_NAME}: A client conversation needs your reply. Reason: ${reason.slice(0, 120)}`,
    });
  }

  async sendStylistReply(
    stylistId: string,
    conversationId: string,
    content: string,
  ): Promise<ConversationDetail> {
    const conversation = await messagingRepository.getConversationForStylist(
      stylistId,
      conversationId,
    );
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    if (conversation.status !== 'escalated') {
      throw new ApiError(
        'FORBIDDEN',
        'Take over the conversation via escalation before replying',
        403,
      );
    }

    await this.sendMessage({
      conversationId,
      stylistId,
      sender: 'stylist',
      content,
    });

    return this.getConversation(stylistId, conversationId);
  }

  async resolveEscalation(
    stylistId: string,
    conversationId: string,
    resolvedById: string,
  ): Promise<ConversationDetail> {
    const conversation = await messagingRepository.getConversationForStylist(
      stylistId,
      conversationId,
    );
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    if (conversation.status !== 'escalated') {
      throw new ApiError('CONFLICT', 'Conversation is not escalated', 409);
    }

    const resolved = await messagingRepository.resolveEscalation({
      conversationId,
      resolvedById,
    });

    if (!resolved) {
      throw ApiError.notFound('No open escalation found');
    }

    await this.sendOutboundMessage({
      conversationId,
      stylistId,
      sender: 'system',
      content: 'Thanks for your patience — our assistant is back and can help with your booking.',
    });

    return this.getConversation(stylistId, conversationId);
  }

  async escalateFromSystem(
    conversationId: string,
    reason: string,
    modelContext?: { modelConfidence?: number; modelNextAction?: string },
  ): Promise<void> {
    const conversation = await messagingRepository.getConversationById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    if (conversation.status === 'escalated') {
      return;
    }

    await messagingRepository.escalateConversation({
      conversationId,
      reason,
      modelConfidence: modelContext?.modelConfidence,
      modelNextAction: modelContext?.modelNextAction,
    });
    void emitConversationEscalated({
      conversationId,
      stylistId: conversation.stylistId,
      reason,
    }).catch(() => {});
    await this.notifyStylistOfEscalation(conversation.stylistId, reason);

    await this.sendOutboundMessage({
      conversationId,
      stylistId: conversation.stylistId,
      sender: 'system',
      content:
        'A stylist will reply to you shortly. Please hold on — your message is important to us.',
    });
  }

  async findOrCreateSmsConversation(input: {
    stylistId: string;
    clientId: string;
    channel?: ConversationChannel;
  }) {
    const channel = input.channel ?? 'sms';
    const existing = await messagingRepository.findOpenConversation(
      input.stylistId,
      input.clientId,
      channel,
    );
    if (existing) return existing;

    return messagingRepository.createConversation({
      stylistId: input.stylistId,
      clientId: input.clientId,
      channel,
    });
  }
}

export const messagingService = new MessagingService();
