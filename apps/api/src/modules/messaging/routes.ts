import type { FastifyPluginAsync } from 'fastify';
import {
  conversationListQuerySchema,
  escalateConversationRequestSchema,
  inboundSmsDevRequestSchema,
  resolveEscalationRequestSchema,
  sendConversationMessageRequestSchema,
  setSmsBookingNumberRequestSchema,
  startClientConversationRequestSchema,
} from '@project-braids/shared-types/api';
import { sendData } from '../../lib/http.js';
import { requireClient, requireStylist } from '../identity/guards.js';
import type { AuthenticatedRequest } from '../identity/middleware.js';
import { receptionistService } from '../receptionist/service.js';
import { messagingService } from './service.js';

export const messagingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/booking-number', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const result = await messagingService.getBookingNumber(auth.stylistId!);
    sendData(reply, result);
  });

  app.put('/booking-number', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = setSmsBookingNumberRequestSchema.parse(request.body);
    const result = await messagingService.setBookingNumber(auth.stylistId!, body.smsBookingNumber);
    sendData(reply, result);
  });

  app.get('/conversations', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const query = conversationListQuerySchema.parse(request.query);
    const conversations = await messagingService.listConversations(auth.stylistId!, query);
    sendData(reply, conversations);
  });

  app.get('/client/conversations', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const query = conversationListQuerySchema.parse(request.query);
    const conversations = await messagingService.listClientConversations(auth.user.id, {
      limit: query.limit,
      offset: query.offset,
    });
    sendData(reply, conversations);
  });

  app.post('/client/conversations', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const body = startClientConversationRequestSchema.parse(request.body);
    const result = await messagingService.startClientWebConversation(auth.user.id, body.stylistId);
    sendData(reply, result, 201);
  });

  app.get('/client/conversations/:id', { preHandler: [requireClient] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const conversation = await messagingService.getClientConversation(auth.user.id, id);
    sendData(reply, conversation);
  });

  app.post(
    '/client/conversations/:id/messages',
    { preHandler: [requireClient] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const body = sendConversationMessageRequestSchema.parse(request.body);
      const inbound = await messagingService.receiveClientWebMessage(
        auth.user.id,
        id,
        body.content,
      );
      if (!inbound.duplicate) {
        await receptionistService.processInboundTurn(inbound.conversationId);
      }
      const conversation = await messagingService.getClientConversation(auth.user.id, id);
      sendData(reply, conversation);
    },
  );

  app.get('/conversations/:id', { preHandler: [requireStylist] }, async (request, reply) => {
    const auth = (request as AuthenticatedRequest).auth;
    const { id } = request.params as { id: string };
    const conversation = await messagingService.getConversation(auth.stylistId!, id);
    sendData(reply, conversation);
  });

  app.post(
    '/conversations/:id/escalate',
    { preHandler: [requireStylist] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const body = escalateConversationRequestSchema.parse(request.body);
      const conversation = await messagingService.escalateConversation(
        auth.stylistId!,
        id,
        body.reason,
      );
      sendData(reply, conversation);
    },
  );

  app.post(
    '/conversations/:id/messages',
    { preHandler: [requireStylist] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      const body = sendConversationMessageRequestSchema.parse(request.body);
      const conversation = await messagingService.sendStylistReply(
        auth.stylistId!,
        id,
        body.content,
      );
      sendData(reply, conversation);
    },
  );

  app.post(
    '/conversations/:id/resolve-escalation',
    { preHandler: [requireStylist] },
    async (request, reply) => {
      const auth = (request as AuthenticatedRequest).auth;
      const { id } = request.params as { id: string };
      resolveEscalationRequestSchema.parse(request.body ?? {});
      const conversation = await messagingService.resolveEscalation(
        auth.stylistId!,
        id,
        auth.user.id,
      );
      sendData(reply, conversation);
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    app.post('/dev/inbound-sms', async (request, reply) => {
      const body = inboundSmsDevRequestSchema.parse(request.body);
      const result = await messagingService.handleInboundSms({
        from: body.from,
        to: body.to,
        body: body.body,
        providerMessageId: body.messageSid ?? `dev-${Date.now()}`,
      });
      if (!result.duplicate) {
        await receptionistService.processInboundTurn(result.conversationId);
      }
      sendData(reply, result);
    });
  }
};
