export type ConnectAccountStatus = {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
};

export type CreateDepositPaymentInput = {
  bookingId: string;
  amountPence: number;
  currency: string;
  connectedAccountId: string;
  stylistId: string;
  clientId: string;
};

export type CreateDepositPaymentResult = {
  paymentIntentId: string;
  clientSecret: string;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export interface StripeProvider {
  createConnectAccount(input: {
    stylistId: string;
    email?: string;
  }): Promise<{ stripeAccountId: string }>;

  createConnectAccountLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }>;

  retrieveConnectAccount(stripeAccountId: string): Promise<ConnectAccountStatus>;

  createDepositPaymentIntent(input: CreateDepositPaymentInput): Promise<CreateDepositPaymentResult>;

  retrieveDepositPaymentIntent(paymentIntentId: string): Promise<CreateDepositPaymentResult>;

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent;
}
