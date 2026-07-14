import https from 'node:https';
import Stripe from 'stripe';
import type {
  ConnectAccountStatus,
  CreateDepositPaymentInput,
  CreateDepositPaymentResult,
  StripePaymentIntentStatus,
  StripePayoutRecord,
  StripeProvider,
  StripeWebhookEvent,
} from './stripe-provider.js';
import { createMockStripeProvider, MockStripeProvider } from './mock-stripe-provider.js';
import { getEnv } from '../../config/env.js';
import { mapV1ConnectAccount, mapV2ConnectAccount } from './connect-v2.js';

const STRIPE_CALL_TIMEOUT_MS = 10_000;

function withStripeCallTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${STRIPE_CALL_TIMEOUT_MS / 1000}s`));
    }, STRIPE_CALL_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

class LiveStripeProvider implements StripeProvider {
  constructor(private readonly stripe: Stripe) {}

  async createConnectAccount(input: {
    stylistId: string;
    email?: string;
  }): Promise<{ stripeAccountId: string }> {
    const displayName = input.email?.split('@')[0] ?? `Stylist ${input.stylistId.slice(0, 8)}`;

    const account = await withStripeCallTimeout(
      this.stripe.v2.core.accounts.create({
        display_name: displayName,
        contact_email: input.email,
        identity: {
          country: 'gb',
        },
        dashboard: 'express',
        defaults: {
          responsibilities: {
            fees_collector: 'application',
            losses_collector: 'application',
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true,
                },
              },
            },
          },
          merchant: {
            capabilities: {
              card_payments: {
                requested: true,
              },
            },
          },
        },
        metadata: {
          stylistId: input.stylistId,
        },
      }),
      'Stripe Connect account creation',
    );

    return { stripeAccountId: account.id };
  }

  async createConnectAccountLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    const link = await withStripeCallTimeout(
      this.stripe.v2.core.accountLinks.create({
        account: input.stripeAccountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['recipient', 'merchant'],
            refresh_url: input.refreshUrl,
            return_url: input.returnUrl,
          },
        },
      }),
      'Stripe Connect onboarding link',
    );

    if (!link.url) {
      throw new Error('Stripe returned an empty onboarding URL');
    }

    return { url: link.url };
  }

  async retrieveConnectAccount(stripeAccountId: string): Promise<ConnectAccountStatus> {
    try {
      const account = await withStripeCallTimeout(
        this.stripe.v2.core.accounts.retrieve(stripeAccountId, {
          include: ['configuration.recipient', 'requirements'],
        }),
        'Stripe Connect account retrieval',
      );
      return mapV2ConnectAccount(account);
    } catch {
      const account = await withStripeCallTimeout(
        this.stripe.accounts.retrieve(stripeAccountId),
        'Stripe Connect account retrieval (legacy)',
      );
      return mapV1ConnectAccount(account);
    }
  }

  /**
   * Ch.9.5 — destination charges: funds route to the connected account balance;
   * Stripe Connect handles payout scheduling to the stylist's bank.
   */
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

  async retrievePaymentIntentStatus(paymentIntentId: string): Promise<StripePaymentIntentStatus> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'succeeded') return 'succeeded';
    if (intent.status === 'canceled') return 'canceled';
    if (intent.status === 'requires_payment_method' || intent.status === 'requires_confirmation') {
      return 'pending';
    }
    return 'failed';
  }

  async createRefund(input: {
    paymentIntentId: string;
    amountPence?: number;
  }): Promise<{ refundId: string }> {
    const refund = await this.stripe.refunds.create({
      payment_intent: input.paymentIntentId,
      ...(input.amountPence ? { amount: input.amountPence } : {}),
    });
    return { refundId: refund.id };
  }

  async listPayouts(connectedAccountId: string): Promise<StripePayoutRecord[]> {
    const result = await this.stripe.payouts.list(
      { limit: 25 },
      { stripeAccount: connectedAccountId },
    );
    return result.data.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
      createdAt: new Date(payout.created * 1000).toISOString(),
    }));
  }

  async submitDisputeEvidence(input: {
    disputeId: string;
    evidence: Record<string, unknown>;
  }): Promise<{ submitted: boolean }> {
    await this.stripe.disputes.update(input.disputeId, {
      evidence: input.evidence as Stripe.DisputeUpdateParams.Evidence,
    });
    return { submitted: true };
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

function createLiveStripeClient(): Stripe {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    timeout: 8_000,
    maxNetworkRetries: 0,
    httpAgent: new https.Agent({ keepAlive: false }),
  });
}

let stripeProvider: StripeProvider | undefined;

/** Fresh client for Connect onboarding — avoids hung keep-alive sockets in dev. */
export function createFreshStripeProvider(): StripeProvider {
  if (!getEnv().STRIPE_SECRET_KEY) {
    return createMockStripeProvider();
  }
  return new LiveStripeProvider(createLiveStripeClient());
}

export function getStripeProvider(): StripeProvider {
  if (!stripeProvider) {
    if (getEnv().STRIPE_SECRET_KEY) {
      stripeProvider = new LiveStripeProvider(createLiveStripeClient());
    } else {
      stripeProvider = createMockStripeProvider();
    }
  }
  return stripeProvider;
}

/** Reset cached provider (tests / env hot-reload). */
export function resetStripeProvider(): void {
  stripeProvider = undefined;
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
