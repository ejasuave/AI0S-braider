export type SmsMessage = {
  to: string;
  body: string;
};

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

let lastDevOtp: { phoneNumber: string; code: string } | undefined;

export function getLastDevOtp(): { phoneNumber: string; code: string } | undefined {
  return lastDevOtp;
}

export function clearLastDevOtp(): void {
  lastDevOtp = undefined;
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      const match = message.body.match(/\b(\d{6})\b/);
      if (match?.[1]) {
        lastDevOtp = { phoneNumber: message.to, code: match[1] };
      }
    }

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.info(`[sms] to=${message.to} body=${message.body}`);
    }
  }
}

let smsProvider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (!smsProvider) {
    smsProvider = new ConsoleSmsProvider();
  }
  return smsProvider;
}

export function setSmsProvider(provider: SmsProvider): void {
  smsProvider = provider;
}
