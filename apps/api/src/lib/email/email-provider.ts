export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body (always required). */
  body: string;
  /** Optional HTML alternative. */
  html?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[email] to=${message.to} subject=${message.subject}${message.html ? ' (html)' : ''}`,
    );
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.info(`[email] body=\n${message.body}`);
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend email failed (${response.status}): ${detail || response.statusText}`);
    }
  }
}

export class CapturingEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

let emailProvider: EmailProvider | undefined;

export function createEmailProviderFromEnv(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PLATFORM_DISPLAY_NAME: string;
}): EmailProvider {
  if (env.RESEND_API_KEY) {
    const from = env.EMAIL_FROM ?? `${env.PLATFORM_DISPLAY_NAME} <onboarding@resend.dev>`;
    return new ResendEmailProvider(env.RESEND_API_KEY, from);
  }
  return new ConsoleEmailProvider();
}

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    emailProvider = createEmailProviderFromEnv({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      PLATFORM_DISPLAY_NAME: process.env.PLATFORM_DISPLAY_NAME ?? 'Project Braids',
    });
  }
  return emailProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  emailProvider = provider;
}

export function resetEmailProviderForTests(): void {
  emailProvider = undefined;
}

/** Staging/production must use Resend for staff invites — do not silently log. */
export function assertTransactionalEmailConfigured(env: {
  NODE_ENV: string;
  RESEND_API_KEY?: string;
}): void {
  if ((env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') && !env.RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY is required to send invitation emails in staging/production. Set RESEND_API_KEY and optionally EMAIL_FROM.',
    );
  }
}
