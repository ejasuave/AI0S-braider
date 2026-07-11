import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from '../../config/env.js';
import type { SmsMessage, SmsProvider } from './sms-provider.types.js';
import { isTwilioConfigured, TwilioSmsProvider } from './twilio-sms-provider.js';

export type { SmsMessage, SmsProvider } from './sms-provider.types.js';

let lastDevOtp: { phoneNumber: string; code: string } | undefined;

export function getLastDevOtp(): { phoneNumber: string; code: string } | undefined {
  return lastDevOtp;
}

export function clearLastDevOtp(): void {
  lastDevOtp = undefined;
}

/** Test helper for custom SMS providers that still need OTP capture. */
export function setLastDevOtpForTests(phoneNumber: string, code: string): void {
  lastDevOtp = { phoneNumber, code };
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<{ providerMessageId?: string }> {
    const match = message.body.match(/\b(\d{6})\b/);
    if (match?.[1] && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      lastDevOtp = { phoneNumber: message.to, code: match[1] };
      if (process.env.NODE_ENV === 'development') {
        const otpPath = path.resolve(process.cwd(), '../../.local/last-otp.json');
        await mkdir(path.dirname(otpPath), { recursive: true });
        await writeFile(otpPath, JSON.stringify(lastDevOtp, null, 2), 'utf8');
      }
    }

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      const from = message.from ? ` from=${message.from}` : '';
      console.info(`[sms] to=${message.to}${from} body=${message.body}`);
    }

    return { providerMessageId: `dev-${Date.now()}` };
  }
}

let smsProvider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (!smsProvider) {
    const env = getEnv();
    smsProvider = isTwilioConfigured(env) ? new TwilioSmsProvider(env) : new ConsoleSmsProvider();
  }
  return smsProvider;
}

export function setSmsProvider(provider: SmsProvider): void {
  smsProvider = provider;
}

export function isSmsLiveMode(): boolean {
  return isTwilioConfigured(getEnv());
}
