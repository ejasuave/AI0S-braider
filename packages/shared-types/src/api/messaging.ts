import { z } from 'zod';

export const conversationChannelSchema = z.enum(['sms', 'whatsapp', 'web']);
export type ConversationChannel = z.infer<typeof conversationChannelSchema>;

export const conversationStatusSchema = z.enum(['active', 'escalated', 'resolved', 'abandoned']);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const messageSenderSchema = z.enum(['client', 'ai', 'stylist', 'system']);
export type MessageSender = z.infer<typeof messageSenderSchema>;

export const messageDeliveryStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'undelivered',
]);
export type MessageDeliveryStatus = z.infer<typeof messageDeliveryStatusSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sender: messageSenderSchema,
  content: z.string(),
  structuredOutput: z.record(z.unknown()).nullable(),
  deliveryStatus: messageDeliveryStatusSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof messageSchema>;

export const escalationSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  reason: z.string(),
  modelConfidence: z.number().min(0).max(1).nullable(),
  modelNextAction: z.string().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedById: z.string().uuid().nullable(),
});
export type Escalation = z.infer<typeof escalationSchema>;

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  stylistId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientPhoneNumber: z.string().optional(),
  stylistBusinessName: z.string().optional(),
  /** Present on client-facing threads so the app can deep-link to SMS. */
  smsBookingNumber: z.string().nullable().optional(),
  channel: conversationChannelSchema,
  status: conversationStatusSchema,
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  openEscalation: escalationSchema.nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const conversationListQuerySchema = z.object({
  status: conversationStatusSchema.optional(),
  escalatedOnly: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
});
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;

export const conversationListResponseSchema = z.object({
  items: z.array(conversationSummarySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;

export const setSmsBookingNumberRequestSchema = z.object({
  smsBookingNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid E.164 phone number'),
});
export type SetSmsBookingNumberRequest = z.infer<typeof setSmsBookingNumberRequestSchema>;

export const stylistSmsBookingNumberSchema = z.object({
  smsBookingNumber: z.string().nullable(),
});
export type StylistSmsBookingNumber = z.infer<typeof stylistSmsBookingNumberSchema>;

export const escalateConversationRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type EscalateConversationRequest = z.infer<typeof escalateConversationRequestSchema>;

export const sendConversationMessageRequestSchema = z.object({
  content: z.string().min(1).max(1600),
});
export type SendConversationMessageRequest = z.infer<typeof sendConversationMessageRequestSchema>;

/** Authenticated client starts (or resumes) an in-app web conversation with a stylist. */
export const startClientConversationRequestSchema = z.object({
  stylistId: z.string().uuid(),
});
export type StartClientConversationRequest = z.infer<typeof startClientConversationRequestSchema>;

export const startClientConversationResponseSchema = z.object({
  conversationId: z.string().uuid(),
});
export type StartClientConversationResponse = z.infer<typeof startClientConversationResponseSchema>;

export const resolveEscalationRequestSchema = z.object({
  note: z.string().max(500).optional(),
});
export type ResolveEscalationRequest = z.infer<typeof resolveEscalationRequestSchema>;

export const inboundSmsDevRequestSchema = z.object({
  from: z.string().regex(/^\+[1-9]\d{6,14}$/),
  to: z.string().regex(/^\+[1-9]\d{6,14}$/),
  body: z.string().min(1).max(1600),
  messageSid: z.string().min(1).optional(),
});
export type InboundSmsDevRequest = z.infer<typeof inboundSmsDevRequestSchema>;

export const inboundSmsResultSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  duplicate: z.boolean(),
});
export type InboundSmsResult = z.infer<typeof inboundSmsResultSchema>;
