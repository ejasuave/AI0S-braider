export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.info(`[email] to=${message.to} subject=${message.subject}`);
    }
  }
}

let emailProvider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    emailProvider = new ConsoleEmailProvider();
  }
  return emailProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  emailProvider = provider;
}
