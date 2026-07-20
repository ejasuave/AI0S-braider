import twilio from 'twilio';
import type { ApiEnv } from '@project-braids/shared-types/env';
import { ApiError } from '../errors.js';
import type { SmsMessage, SmsProvider } from './sms-provider.types.js';

function mapTwilioSendError(error: unknown): ApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? Number((error as { code?: unknown }).code)
      : undefined;
  const message = error instanceof Error ? error.message : 'Failed to send SMS via Twilio';

  // Trial / geo / invalid destination — actionable client errors, not opaque 500s.
  if (code === 21608 || code === 21408 || code === 21211 || code === 21614) {
    return ApiError.validation(message);
  }
  if (code === 20003) {
    return ApiError.serviceUnavailable(
      'SMS provider authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    );
  }

  return ApiError.serviceUnavailable(message);
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly client: ReturnType<typeof twilio>;
  private readonly defaultFrom: string;

  constructor(env: ApiEnv) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials are not fully configured');
    }
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    this.defaultFrom = env.TWILIO_PHONE_NUMBER;
  }

  async send(message: SmsMessage): Promise<{ providerMessageId?: string }> {
    try {
      const result = await this.client.messages.create({
        to: message.to,
        from: message.from ?? this.defaultFrom,
        body: message.body,
      });
      return { providerMessageId: result.sid };
    } catch (error) {
      throw mapTwilioSendError(error);
    }
  }
}

export function validateTwilioWebhookSignature(
  env: ApiEnv,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!env.TWILIO_AUTH_TOKEN) {
    return false;
  }
  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
}

export function isTwilioConfigured(env: ApiEnv): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
}
