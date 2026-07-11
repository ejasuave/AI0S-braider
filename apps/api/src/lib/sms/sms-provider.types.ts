export type SmsMessage = {
  to: string;
  body: string;
  from?: string;
};

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ providerMessageId?: string }>;
}
