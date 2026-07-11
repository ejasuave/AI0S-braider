import twilio from 'twilio';
import type { ApiEnv } from '@project-braids/shared-types/env';
import type { SmsMessage, SmsProvider } from './sms-provider.types.js';

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
    const result = await this.client.messages.create({
      to: message.to,
      from: message.from ?? this.defaultFrom,
      body: message.body,
    });
    return { providerMessageId: result.sid };
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
