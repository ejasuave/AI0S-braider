import type { FastifyPluginAsync } from 'fastify';
import formbody from '@fastify/formbody';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { sendData } from '../../lib/http.js';
import {
  validateTwilioWebhookSignature,
  isTwilioConfigured,
} from '../../lib/sms/twilio-sms-provider.js';
import { processWebhookIdempotently } from '../../lib/webhooks/idempotent-handler.js';
import { normalizePhoneNumber } from '../../lib/phone.js';
import { clientPreferencesService } from '../client-preferences/service.js';
import { isStartKeyword, isStopKeyword } from '../notifications/opt-out.js';
import { getSmsProvider } from '../../lib/sms/sms-provider.js';
import { receptionistService } from '../receptionist/service.js';
import { messagingService } from './service.js';

type TwilioSmsPayload = {
  MessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
};

type TwilioStatusPayload = {
  MessageSid?: string;
  MessageStatus?: string;
};

export const twilioWebhookRoutes: FastifyPluginAsync = async (app) => {
  await app.register(formbody);

  app.post('/twilio/sms', async (request, reply) => {
    const env = getEnv();
    const params = request.body as TwilioSmsPayload;

    const messageSid = params.MessageSid;
    const from = params.From;
    const to = params.To;
    const body = params.Body;

    if (!messageSid || !from || !to || body === undefined) {
      throw ApiError.validation('Invalid Twilio SMS webhook payload');
    }

    if (isTwilioConfigured(env)) {
      const signature = request.headers['x-twilio-signature'];
      if (!signature || typeof signature !== 'string') {
        throw new ApiError('UNAUTHORIZED', 'Missing Twilio signature', 401);
      }

      const webhookUrl = `${env.API_PUBLIC_URL}/api/v1/webhooks/twilio/sms`;
      const valid = validateTwilioWebhookSignature(
        env,
        signature,
        webhookUrl,
        Object.fromEntries(
          Object.entries(params).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        ),
      );

      if (!valid) {
        throw new ApiError('UNAUTHORIZED', 'Invalid Twilio signature', 401);
      }
    } else if (env.NODE_ENV === 'production') {
      throw ApiError.internal('Twilio is not configured');
    }

    const outcome = await processWebhookIdempotently({
      eventId: messageSid,
      source: 'twilio',
      handler: async () => {
        const normalizedFrom = normalizePhoneNumber(from);

        if (isStopKeyword(body)) {
          const reply = await clientPreferencesService.handleStopKeyword(normalizedFrom);
          await getSmsProvider().send({ to: normalizedFrom, from: to, body: reply });
          return { type: 'stop' as const };
        }

        if (isStartKeyword(body)) {
          const reply = await clientPreferencesService.handleStartKeyword(normalizedFrom);
          await getSmsProvider().send({ to: normalizedFrom, from: to, body: reply });
          return { type: 'start' as const };
        }

        const inbound = await messagingService.handleInboundSms({
          from,
          to,
          body,
          providerMessageId: messageSid,
        });
        if (!inbound.duplicate) {
          await receptionistService.processInboundTurn(inbound.conversationId);
        }
        return inbound;
      },
    });

    if (outcome.status === 'duplicate') {
      void reply.status(200).type('text/xml').send('<Response></Response>');
      return;
    }

    void reply.status(200).type('text/xml').send('<Response></Response>');
  });

  app.post('/twilio/sms/status', async (request, reply) => {
    const params = request.body as TwilioStatusPayload;
    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;

    if (!messageSid || !messageStatus) {
      throw ApiError.validation('Invalid Twilio status callback payload');
    }

    await messagingService.updateSmsDeliveryStatus({
      providerMessageId: messageSid,
      twilioStatus: messageStatus,
    });

    void reply.status(200).send('');
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/twilio/sms/health', async (_request, reply) => {
      sendData(reply, { ready: true });
    });
  }
};
