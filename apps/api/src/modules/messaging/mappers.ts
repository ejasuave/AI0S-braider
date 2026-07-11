import type { Conversation, Escalation, Message } from '@prisma/client';
import type {
  ConversationDetail,
  ConversationSummary,
  Message as MessageDto,
} from '@project-braids/shared-types/api';

function toIso(date: Date): string {
  return date.toISOString();
}

export function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    content: message.content,
    structuredOutput:
      message.structuredOutput && typeof message.structuredOutput === 'object'
        ? (message.structuredOutput as Record<string, unknown>)
        : null,
    deliveryStatus: message.deliveryStatus ?? null,
    createdAt: toIso(message.createdAt),
  };
}

export function toEscalationDto(escalation: Escalation) {
  return {
    id: escalation.id,
    conversationId: escalation.conversationId,
    reason: escalation.reason,
    modelConfidence: escalation.modelConfidence ?? null,
    modelNextAction: escalation.modelNextAction ?? null,
    createdAt: toIso(escalation.createdAt),
    resolvedAt: escalation.resolvedAt ? toIso(escalation.resolvedAt) : null,
    resolvedById: escalation.resolvedById,
  };
}

export function toConversationSummary(
  conversation: Conversation & {
    messages: Message[];
    escalations: Escalation[];
  },
  options: {
    clientPhoneNumber?: string;
    stylistBusinessName?: string;
  } = {},
): ConversationSummary {
  const latest = conversation.messages[0];
  const openEscalation = conversation.escalations[0] ?? null;

  return {
    id: conversation.id,
    stylistId: conversation.stylistId,
    clientId: conversation.clientId,
    clientPhoneNumber: options.clientPhoneNumber,
    stylistBusinessName: options.stylistBusinessName,
    channel: conversation.channel,
    status: conversation.status,
    lastMessagePreview: latest?.content ?? null,
    lastMessageAt: toIso(conversation.lastMessageAt),
    createdAt: toIso(conversation.createdAt),
    openEscalation: openEscalation ? toEscalationDto(openEscalation) : null,
  };
}

export function toConversationDetail(
  conversation: Conversation & {
    messages: Message[];
    escalations: Escalation[];
  },
  options: {
    clientPhoneNumber?: string;
    stylistBusinessName?: string;
  } = {},
): ConversationDetail {
  const openEscalation = conversation.escalations.find((item) => item.resolvedAt === null) ?? null;

  return {
    ...toConversationSummary(
      {
        ...conversation,
        messages: conversation.messages.length
          ? [conversation.messages[conversation.messages.length - 1]!]
          : [],
        escalations: openEscalation ? [openEscalation] : [],
      },
      options,
    ),
    messages: conversation.messages.map(toMessageDto),
    openEscalation: openEscalation ? toEscalationDto(openEscalation) : null,
  };
}
