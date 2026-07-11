import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Escalation,
  Message,
  MessageDeliveryStatus,
  MessageSender,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/db.js';

const OPEN_STATUSES: ConversationStatus[] = ['active', 'escalated'];

export type ConversationWithRelations = Conversation & {
  messages?: Message[];
  escalations?: Escalation[];
  stylist?: { businessName: string };
};

export class MessagingRepository {
  async findStylistBySmsNumber(smsBookingNumber: string) {
    return prisma.stylistProfile.findUnique({
      where: { smsBookingNumber },
      select: { id: true, smsBookingNumber: true, businessName: true },
    });
  }

  async getStylistSmsNumber(stylistId: string): Promise<string | null> {
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { smsBookingNumber: true },
    });
    return profile?.smsBookingNumber ?? null;
  }

  async setStylistSmsNumber(stylistId: string, smsBookingNumber: string) {
    return prisma.stylistProfile.update({
      where: { id: stylistId },
      data: { smsBookingNumber },
      select: { id: true, smsBookingNumber: true },
    });
  }

  async findOpenConversation(
    stylistId: string,
    clientId: string,
    channel: ConversationChannel,
  ): Promise<Conversation | null> {
    return prisma.conversation.findFirst({
      where: {
        stylistId,
        clientId,
        channel,
        status: { in: OPEN_STATUSES },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async createConversation(input: {
    stylistId: string;
    clientId: string;
    channel: ConversationChannel;
  }): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        stylistId: input.stylistId,
        clientId: input.clientId,
        channel: input.channel,
      },
    });
  }

  async getConversationById(conversationId: string): Promise<ConversationWithRelations | null> {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        escalations: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getConversationForStylist(
    stylistId: string,
    conversationId: string,
  ): Promise<ConversationWithRelations | null> {
    return prisma.conversation.findFirst({
      where: { id: conversationId, stylistId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        escalations: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async listConversationsForStylist(
    stylistId: string,
    filters: {
      status?: ConversationStatus;
      escalatedOnly?: boolean;
      limit: number;
      offset: number;
    },
  ) {
    const where: Prisma.ConversationWhereInput = { stylistId };
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.escalatedOnly) {
      where.status = 'escalated';
    }

    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          escalations: {
            where: { resolvedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { rows, total };
  }

  async listConversationsForClient(
    clientId: string,
    filters: { limit: number; offset: number },
  ) {
    const where: Prisma.ConversationWhereInput = { clientId };

    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          escalations: {
            where: { resolvedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          stylist: { select: { businessName: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { rows, total };
  }

  async getConversationForClient(
    clientId: string,
    conversationId: string,
  ): Promise<ConversationWithRelations | null> {
    return prisma.conversation.findFirst({
      where: { id: conversationId, clientId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        escalations: { orderBy: { createdAt: 'desc' } },
        stylist: { select: { businessName: true } },
      },
    });
  }

  async getStylistOwnerPhone(stylistId: string): Promise<string | null> {
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { user: { select: { phoneNumber: true } } },
    });
    return profile?.user.phoneNumber ?? null;
  }

  async updateMessageDeliveryStatus(
    providerMessageId: string,
    deliveryStatus: MessageDeliveryStatus,
  ): Promise<Message | null> {
    try {
      return await prisma.message.update({
        where: { providerMessageId },
        data: { deliveryStatus },
      });
    } catch {
      return null;
    }
  }

  async attachOutboundProviderMessage(
    messageId: string,
    providerMessageId: string,
    deliveryStatus: MessageDeliveryStatus,
  ): Promise<Message> {
    return prisma.message.update({
      where: { id: messageId },
      data: { providerMessageId, deliveryStatus },
    });
  }

  async findMessageByProviderId(providerMessageId: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { providerMessageId },
    });
  }

  async appendMessage(input: {
    conversationId: string;
    sender: MessageSender;
    content: string;
    structuredOutput?: Prisma.InputJsonValue;
    providerMessageId?: string;
    deliveryStatus?: MessageDeliveryStatus;
  }): Promise<Message> {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          sender: input.sender,
          content: input.content,
          structuredOutput: input.structuredOutput,
          providerMessageId: input.providerMessageId,
          deliveryStatus: input.deliveryStatus,
        },
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: now },
      });

      return message;
    });
  }

  async escalateConversation(input: {
    conversationId: string;
    reason: string;
    modelConfidence?: number;
    modelNextAction?: string;
  }): Promise<Escalation> {
    return prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { status: 'escalated' },
      });

      return tx.escalation.create({
        data: {
          conversationId: input.conversationId,
          reason: input.reason,
          modelConfidence: input.modelConfidence,
          modelNextAction: input.modelNextAction,
        },
      });
    });
  }

  async resolveEscalation(input: {
    conversationId: string;
    resolvedById: string;
  }): Promise<Escalation | null> {
    return prisma.$transaction(async (tx) => {
      const open = await tx.escalation.findFirst({
        where: { conversationId: input.conversationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!open) {
        return null;
      }

      const resolved = await tx.escalation.update({
        where: { id: open.id },
        data: {
          resolvedAt: new Date(),
          resolvedById: input.resolvedById,
        },
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { status: 'active' },
      });

      return resolved;
    });
  }

  async getClientPhoneNumber(clientId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      select: { phoneNumber: true },
    });
    return user?.phoneNumber ?? null;
  }
  async getLatestClientMessage(conversationId: string): Promise<Message | null> {
    return prisma.message.findFirst({
      where: { conversationId, sender: 'client' },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const messagingRepository = new MessagingRepository();
