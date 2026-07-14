export type ConnectAccountStatus = {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  restricted?: boolean;
};

export type CreateDepositPaymentInput = {
  bookingId: string;
  amountPence: number;
  currency: string;
  connectedAccountId: string;
  stylistId: string;
  clientId: string;
  /** Defaults to deposit when omitted. */
  paymentKind?: 'deposit' | 'balance';
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

export type StripePayoutRecord = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  createdAt: string;
};

export type StripePaymentIntentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

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

  retrievePaymentIntentStatus(paymentIntentId: string): Promise<StripePaymentIntentStatus>;

  createRefund(input: {
    paymentIntentId: string;
    amountPence?: number;
  }): Promise<{ refundId: string }>;

  listPayouts(connectedAccountId: string): Promise<StripePayoutRecord[]>;

  submitDisputeEvidence(input: {
    disputeId: string;
    evidence: Record<string, unknown>;
  }): Promise<{ submitted: boolean }>;

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent;
}
