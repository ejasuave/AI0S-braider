import { createHmac, randomUUID } from 'node:crypto';
import type {
  ConnectAccountStatus,
  CreateDepositPaymentInput,
  CreateDepositPaymentResult,
  StripeProvider,
  StripeWebhookEvent,
} from './stripe-provider.js';

type MockPaymentIntent = {
  id: string;
  bookingId: string;
  status: 'requires_payment_method' | 'succeeded';
};

const accounts = new Map<string, ConnectAccountStatus>();
const paymentIntents = new Map<string, MockPaymentIntent>();

export class MockStripeProvider implements StripeProvider {
  async createConnectAccount(input: {
    stylistId: string;
    email?: string;
  }): Promise<{ stripeAccountId: string }> {
    void input.email;
    const stripeAccountId = `acct_mock_${input.stylistId.replace(/-/g, '').slice(0, 12)}`;
    accounts.set(stripeAccountId, {
      stripeAccountId,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingComplete: false,
    });
    return { stripeAccountId };
  }

  async createConnectAccountLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    return {
      url: `${input.returnUrl}?mock_stripe_account=${input.stripeAccountId}&refresh=${encodeURIComponent(input.refreshUrl)}`,
    };
  }

  async retrieveConnectAccount(stripeAccountId: string): Promise<ConnectAccountStatus> {
    const account = accounts.get(stripeAccountId);
    if (!account) {
      return {
        stripeAccountId,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }
    return account;
  }

  markConnectAccountReady(stripeAccountId: string): void {
    accounts.set(stripeAccountId, {
      stripeAccountId,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingComplete: true,
    });
  }

  async createDepositPaymentIntent(
    input: CreateDepositPaymentInput,
  ): Promise<CreateDepositPaymentResult> {
    const paymentIntentId = `pi_mock_${randomUUID().replace(/-/g, '')}`;
    paymentIntents.set(paymentIntentId, {
      id: paymentIntentId,
      bookingId: input.bookingId,
      status: 'requires_payment_method',
    });
    return this.toDepositResult(paymentIntentId);
  }

  async retrieveDepositPaymentIntent(paymentIntentId: string): Promise<CreateDepositPaymentResult> {
    if (!paymentIntents.has(paymentIntentId)) {
      throw new Error(`Unknown mock payment intent: ${paymentIntentId}`);
    }
    return this.toDepositResult(paymentIntentId);
  }

  private toDepositResult(paymentIntentId: string): CreateDepositPaymentResult {
    return {
      paymentIntentId,
      clientSecret: `${paymentIntentId}_secret_mock`,
    };
  }

  buildPaymentIntentSucceededEvent(paymentIntentId: string): StripeWebhookEvent {
    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Unknown mock payment intent: ${paymentIntentId}`);
    }
    intent.status = 'succeeded';
    return {
      id: `evt_mock_${randomUUID().replace(/-/g, '')}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId,
          metadata: { bookingId: intent.bookingId },
        },
      },
    };
  }

  buildAccountUpdatedEvent(stripeAccountId: string): StripeWebhookEvent {
    this.markConnectAccountReady(stripeAccountId);
    return {
      id: `evt_mock_${randomUUID().replace(/-/g, '')}`,
      type: 'account.updated',
      data: {
        object: {
          id: stripeAccountId,
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    };
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    const body = typeof payload === 'string' ? payload : payload.toString('utf8');
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    if (signature !== `mock_${expected}`) {
      throw new Error('Invalid mock webhook signature');
    }
    return JSON.parse(body) as StripeWebhookEvent;
  }

  signWebhookPayload(payload: StripeWebhookEvent, secret: string): string {
    const body = JSON.stringify(payload);
    const digest = createHmac('sha256', secret).update(body).digest('hex');
    return `mock_${digest}`;
  }
}

export function createMockStripeProvider(): MockStripeProvider {
  return new MockStripeProvider();
}
