import Stripe from 'stripe';
import type {
  ConnectAccountStatus,
  CreateDepositPaymentInput,
  CreateDepositPaymentResult,
  StripeProvider,
  StripeWebhookEvent,
} from './stripe-provider.js';
import { createMockStripeProvider, MockStripeProvider } from './mock-stripe-provider.js';
import { getEnv } from '../../config/env.js';

class LiveStripeProvider implements StripeProvider {
  constructor(private readonly stripe: Stripe) {}

  async createConnectAccount(input: {
    stylistId: string;
    email?: string;
  }): Promise<{ stripeAccountId: string }> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: input.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { stylistId: input.stylistId },
    });
    return { stripeAccountId: account.id };
  }

  async createConnectAccountLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: input.stripeAccountId,
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  async retrieveConnectAccount(stripeAccountId: string): Promise<ConnectAccountStatus> {
    const account = await this.stripe.accounts.retrieve(stripeAccountId);
    return {
      stripeAccountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      onboardingComplete: account.details_submitted ?? false,
    };
  }

  async createDepositPaymentIntent(
    input: CreateDepositPaymentInput,
  ): Promise<CreateDepositPaymentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: input.amountPence,
      currency: input.currency,
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: input.connectedAccountId },
      metadata: {
        bookingId: input.bookingId,
        stylistId: input.stylistId,
        clientId: input.clientId,
      },
    });

    if (!intent.client_secret) {
      throw new Error('Stripe did not return a client secret for the deposit PaymentIntent');
    }

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    };
  }

  async retrieveDepositPaymentIntent(paymentIntentId: string): Promise<CreateDepositPaymentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (!intent.client_secret) {
      throw new Error('Stripe did not return a client secret for the deposit PaymentIntent');
    }
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    };
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    return {
      id: event.id,
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    };
  }
}

let stripeProvider: StripeProvider | undefined;

export function getStripeProvider(): StripeProvider {
  if (!stripeProvider) {
    const env = getEnv();
    if (env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      stripeProvider = new LiveStripeProvider(stripe);
    } else {
      stripeProvider = createMockStripeProvider();
    }
  }
  return stripeProvider;
}

export function setStripeProvider(provider: StripeProvider): void {
  stripeProvider = provider;
}

export function getMockStripeProvider(): MockStripeProvider | null {
  const provider = getStripeProvider();
  return provider instanceof MockStripeProvider ? provider : null;
}

export function isStripeMockMode(): boolean {
  return !getEnv().STRIPE_SECRET_KEY;
}
