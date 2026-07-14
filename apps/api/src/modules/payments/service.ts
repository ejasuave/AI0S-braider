import type {
  ConnectOnboardingResponse,
  ConnectStatusResponse,
  DepositPaymentResponse,
  IncomeReport,
  Payment as PaymentDto,
  PayoutHistoryItem,
  StripeConnectStatus,
} from '@project-braids/shared-types/api';
import type { PaymentOnboardingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import {
  createFreshStripeProvider,
  getMockStripeProvider,
  getStripeProvider,
  isStripeMockMode,
} from '../../lib/stripe/index.js';
import type { StripeProvider } from '../../lib/stripe/stripe-provider.js';
import type { ConnectAccountStatus } from '../../lib/stripe/stripe-provider.js';
import { bookingService } from '../booking/service.js';
import { isPaymentReady as isBusinessPaymentReady, allowsMockConnectAccount } from './readiness.js';
import { isTerminalPaymentStatus, toPayment, toPence } from './mappers.js';
import {
  isStaleMockConnectAccount,
  isStaleMockPaymentIntent,
  isRecoverableConnectAccountError,
} from './stripe-compat.js';

const CONNECT_ONBOARDING_TIMEOUT_MS = 30_000;

function assertConnectReturnUrlsAllowed(stripeSecretKey: string | undefined): void {
  if (!stripeSecretKey?.startsWith('sk_live_')) return;

  for (const label of ['STRIPE_CONNECT_RETURN_URL', 'STRIPE_CONNECT_REFRESH_URL'] as const) {
    const raw = getEnv()[label];
    try {
      const host = new URL(raw).hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        throw new ApiError(
          'CONFLICT',
          'Live Stripe keys cannot use localhost return URLs. For local development, use sk_test_/pk_test_ keys in .env, or set STRIPE_CONNECT_RETURN_URL and STRIPE_CONNECT_REFRESH_URL to an HTTPS URL (e.g. an ngrok tunnel to port 3000).',
          422,
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('CONFLICT', `${label} is not a valid URL`, 422);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

function formatStripeConnectError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const normalized = message.toLowerCase();
  if (normalized.includes('managing losses') || normalized.includes('platform-profile')) {
    return `${message} Complete your Connect platform profile at https://dashboard.stripe.com/settings/connect/platform-profile.`;
  }
  if (normalized.includes('card_payments') && normalized.includes('stripe_transfers')) {
    return `Stripe Connect configuration error: ${message}`;
  }
  return `Stripe Connect setup failed: ${message}. In Stripe Dashboard, open Connect → Get started and complete your platform profile.`;
}

async function createConnectAccountForStylist(
  stripe: StripeProvider,
  stylistId: string,
  email?: string,
): Promise<string> {
  try {
    const created = await stripe.createConnectAccount({ stylistId, email });
    return created.stripeAccountId;
  } catch (error) {
    throw new ApiError(
      'CONFLICT',
      formatStripeConnectError(error, 'Stripe Connect account creation failed'),
      422,
    );
  }
}

function deriveOnboardingStatus(status: ConnectAccountStatus): PaymentOnboardingStatus {
  if (status.restricted) {
    return 'restricted';
  }
  if (status.chargesEnabled && status.onboardingComplete) {
    return 'complete';
  }
  if (status.onboardingComplete || status.chargesEnabled || status.payoutsEnabled) {
    return 'in_progress';
  }
  return 'not_started';
}

function toConnectStatus(account: {
  stripeConnectAccountId: string;
  onboardingStatus: PaymentOnboardingStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}): StripeConnectStatus {
  return {
    connected: account.chargesEnabled && account.onboardingStatus === 'complete',
    stripeAccountId: account.stripeConnectAccountId,
    onboardingStatus: account.onboardingStatus,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    onboardingComplete: account.onboardingStatus === 'complete',
  };
}

export class PaymentService {
  /** Ch.9.1 — gate deposit holds when Stripe is not ready. */
  async isPaymentReady(businessId: string): Promise<boolean> {
    return isBusinessPaymentReady(businessId);
  }

  async startConnectOnboarding(
    businessId: string,
    stylistId: string,
    email?: string,
  ): Promise<ConnectOnboardingResponse> {
    const env = getEnv();
    assertConnectReturnUrlsAllowed(env.STRIPE_SECRET_KEY);
    const stripe = createFreshStripeProvider();

    return withTimeout(
      this.startConnectOnboardingInner(businessId, stylistId, email, stripe),
      CONNECT_ONBOARDING_TIMEOUT_MS,
      'Stripe Connect onboarding',
    ).catch((error: unknown) => {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Stripe Connect onboarding failed';
      throw new ApiError('CONFLICT', message, 422);
    });
  }

  private async clearStaleMockPaymentAccount(businessId: string): Promise<void> {
    const existing = await prisma.paymentAccount.findUnique({
      where: { businessId },
    });
    if (
      existing &&
      !allowsMockConnectAccount() &&
      isStaleMockConnectAccount(existing.stripeConnectAccountId)
    ) {
      await prisma.paymentAccount.delete({ where: { businessId } });
    }
  }

  private async startConnectOnboardingInner(
    businessId: string,
    stylistId: string,
    email: string | undefined,
    stripe: StripeProvider,
  ): Promise<ConnectOnboardingResponse> {
    await this.clearStaleMockPaymentAccount(businessId);

    const env = getEnv();

    const existing = await prisma.paymentAccount.findUnique({
      where: { businessId },
    });

    let stripeAccountId = existing?.stripeConnectAccountId;
    if (
      !stripeAccountId ||
      (!allowsMockConnectAccount() && isStaleMockConnectAccount(stripeAccountId))
    ) {
      stripeAccountId = await createConnectAccountForStylist(stripe, stylistId, email);
      await prisma.paymentAccount.upsert({
        where: { businessId },
        create: {
          businessId,
          stripeConnectAccountId: stripeAccountId,
          onboardingStatus: 'not_started',
          chargesEnabled: false,
          payoutsEnabled: false,
        },
        update: {
          stripeConnectAccountId: stripeAccountId,
          onboardingStatus: 'not_started',
          chargesEnabled: false,
          payoutsEnabled: false,
        },
      });
    }

    const createLink = async (accountId: string) => {
      try {
        return await stripe.createConnectAccountLink({
          stripeAccountId: accountId,
          returnUrl: env.STRIPE_CONNECT_RETURN_URL,
          refreshUrl: env.STRIPE_CONNECT_REFRESH_URL,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not create onboarding link';
        throw new ApiError('CONFLICT', message, 422);
      }
    };

    try {
      const link = await createLink(stripeAccountId);
      if (!link.url) {
        throw new ApiError('CONFLICT', 'Stripe returned an empty onboarding URL', 422);
      }
      return {
        stripeAccountId,
        onboardingUrl: link.url,
      };
    } catch (firstError) {
      if (!(firstError instanceof ApiError)) {
        throw firstError;
      }
      if (!isRecoverableConnectAccountError(firstError.message)) {
        throw firstError;
      }

      // Stored Connect account is invalid in live Stripe — create a fresh Express account and retry once.
      stripeAccountId = await createConnectAccountForStylist(stripe, stylistId, email);
      await prisma.paymentAccount.update({
        where: { businessId },
        data: {
          stripeConnectAccountId: stripeAccountId,
          onboardingStatus: 'not_started',
          chargesEnabled: false,
          payoutsEnabled: false,
        },
      });
      const link = await createLink(stripeAccountId);
      if (!link.url) {
        throw new ApiError('CONFLICT', 'Stripe returned an empty onboarding URL', 422);
      }
      return {
        stripeAccountId,
        onboardingUrl: link.url,
      };
    }
  }

  async getConnectStatus(businessId: string): Promise<StripeConnectStatus> {
    const account = await prisma.paymentAccount.findUnique({
      where: { businessId },
    });

    if (!account) {
      return {
        connected: false,
        stripeAccountId: null,
        onboardingStatus: 'not_started',
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    if (!allowsMockConnectAccount() && isStaleMockConnectAccount(account.stripeConnectAccountId)) {
      await prisma.paymentAccount.delete({ where: { businessId } });
      return {
        connected: false,
        stripeAccountId: null,
        onboardingStatus: 'not_started',
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    const stripe = getStripeProvider();
    if (isStripeMockMode()) {
      getMockStripeProvider()?.markConnectAccountReady(account.stripeConnectAccountId);
    }

    try {
      const stripeStatus = await stripe.retrieveConnectAccount(account.stripeConnectAccountId);
      const synced = await this.syncConnectAccount(businessId, stripeStatus);
      return toConnectStatus(synced);
    } catch {
      return {
        connected: false,
        stripeAccountId: account.stripeConnectAccountId,
        onboardingStatus: account.onboardingStatus,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        onboardingComplete: account.onboardingStatus === 'complete',
      };
    }
  }

  /** Legacy stylist-scoped status — resolves business from stylist profile. */
  async getConnectStatusForStylist(stylistId: string): Promise<ConnectStatusResponse> {
    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { businessId: true },
    });
    if (!profile?.businessId) {
      return {
        connected: false,
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }
    const status = await this.getConnectStatus(profile.businessId);
    return {
      connected: status.connected,
      stripeAccountId: status.stripeAccountId,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      onboardingComplete: status.onboardingComplete,
    };
  }

  async syncConnectAccount(businessId: string, status: ConnectAccountStatus) {
    return prisma.paymentAccount.update({
      where: { businessId },
      data: {
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        onboardingStatus: deriveOnboardingStatus(status),
      },
    });
  }

  async syncConnectAccountByStripeId(
    stripeAccountId: string,
    stripeObject?: Record<string, unknown>,
  ): Promise<void> {
    const account = await prisma.paymentAccount.findUnique({
      where: { stripeConnectAccountId: stripeAccountId },
    });
    if (!account) {
      return;
    }

    const status = stripeObject
      ? {
          stripeAccountId,
          chargesEnabled: Boolean(stripeObject.charges_enabled),
          payoutsEnabled: Boolean(stripeObject.payouts_enabled),
          onboardingComplete: Boolean(stripeObject.details_submitted),
          restricted: Boolean(
            stripeObject.requirements && typeof stripeObject.requirements === 'object'
              ? (stripeObject.requirements as { disabled_reason?: string }).disabled_reason
              : false,
          ),
        }
      : await getStripeProvider().retrieveConnectAccount(stripeAccountId);

    await this.syncConnectAccount(account.businessId, status);
  }

  /** @deprecated Use createDepositCharge — retained for receptionist compat. */
  async createDepositPayment(clientId: string, bookingId: string): Promise<DepositPaymentResponse> {
    return this.createDepositCharge(clientId, bookingId);
  }

  async createDepositCharge(clientId: string, bookingId: string): Promise<DepositPaymentResponse> {
    const booking = await bookingService.getBookingForClient(clientId, bookingId);

    if (booking.status !== 'held') {
      throw new ApiError('CONFLICT', 'Deposit can only be paid for held bookings', 409);
    }

    if (booking.depositStatus !== 'pending') {
      throw new ApiError('CONFLICT', 'Deposit has already been processed for this booking', 409);
    }

    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= new Date()) {
      throw new ApiError('CONFLICT', 'Booking hold has expired', 409);
    }

    const profile = await prisma.stylistProfile.findUnique({
      where: { id: booking.stylistId },
      select: { businessId: true },
    });
    if (!profile?.businessId) {
      throw ApiError.notFound('Business not found for booking');
    }

    if (!(await isBusinessPaymentReady(profile.businessId))) {
      throw new ApiError('CONFLICT', 'Stylist has not completed Stripe Connect onboarding', 422);
    }

    const stripe = getStripeProvider();

    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId_kind: { bookingId, kind: 'deposit' } },
    });
    if (existingPayment) {
      if (existingPayment.status === 'pending') {
        if (isStaleMockPaymentIntent(existingPayment.stripePaymentIntentId)) {
          await prisma.payment.delete({ where: { id: existingPayment.id } });
        } else {
          const intent = await stripe.retrieveDepositPaymentIntent(
            existingPayment.stripePaymentIntentId,
          );
          return {
            id: existingPayment.id,
            bookingId: existingPayment.bookingId,
            kind: 'deposit',
            stripePaymentIntentId: existingPayment.stripePaymentIntentId,
            clientSecret: intent.clientSecret,
            amount: existingPayment.amount.toFixed(2),
            currency: existingPayment.currency,
            status: existingPayment.status,
          };
        }
      } else if (isTerminalPaymentStatus(existingPayment.status)) {
        throw new ApiError('CONFLICT', 'A deposit payment already exists for this booking', 409);
      }
    }

    const connectAccount = await prisma.paymentAccount.findUnique({
      where: { businessId: profile.businessId },
    });
    if (!connectAccount?.chargesEnabled) {
      throw new ApiError('CONFLICT', 'Stylist has not completed Stripe Connect onboarding', 422);
    }

    if (
      !allowsMockConnectAccount() &&
      isStaleMockConnectAccount(connectAccount.stripeConnectAccountId)
    ) {
      throw new ApiError(
        'CONFLICT',
        'Stylist must reconnect Stripe — previous setup used development mock accounts',
        422,
      );
    }

    const amountPence = toPence(Number(booking.depositAmount));
    if (amountPence <= 0) {
      throw ApiError.validation('Deposit amount must be greater than zero');
    }

    if (!booking.clientId) {
      throw ApiError.validation('Booking has no client — deposits require a linked client');
    }

    const intent = await stripe.createDepositPaymentIntent({
      bookingId: booking.id,
      amountPence,
      currency: 'gbp',
      connectedAccountId: connectAccount.stripeConnectAccountId,
      stylistId: booking.stylistId,
      clientId: booking.clientId,
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: 'deposit',
        stripePaymentIntentId: intent.paymentIntentId,
        amount: booking.depositAmount,
        currency: 'gbp',
        status: 'pending',
      },
    });

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      kind: 'deposit',
      stripePaymentIntentId: payment.stripePaymentIntentId,
      clientSecret: intent.clientSecret,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status,
    };
  }

  async getPaymentForBooking(
    clientId: string,
    bookingId: string,
    kind: 'deposit' | 'balance' = 'deposit',
  ): Promise<PaymentDto> {
    await bookingService.getBookingForClient(clientId, bookingId);

    const payment = await prisma.payment.findUnique({
      where: { bookingId_kind: { bookingId, kind } },
    });
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    const dto = toPayment(payment);
    if (payment.status === 'pending') {
      if (isStaleMockPaymentIntent(payment.stripePaymentIntentId)) {
        await prisma.payment.delete({ where: { id: payment.id } });
        throw ApiError.notFound('Payment not found');
      }
      const intent = await getStripeProvider().retrieveDepositPaymentIntent(
        payment.stripePaymentIntentId,
      );
      return { ...dto, clientSecret: intent.clientSecret };
    }

    return dto;
  }

  /**
   * After Stripe.js confirms payment on the client, sync capture + booking confirmation.
   * Webhooks remain canonical; this covers local dev and delayed webhook delivery.
   */
  async syncDepositAfterClientCheckout(
    clientId: string,
    bookingId: string,
  ): Promise<{ payment: PaymentDto; bookingConfirmed: boolean }> {
    await bookingService.getBookingForClient(clientId, bookingId);

    const payment = await prisma.payment.findUnique({
      where: { bookingId_kind: { bookingId, kind: 'deposit' } },
    });
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    if (payment.status === 'captured') {
      return this.capturePaymentFromWebhook(payment.stripePaymentIntentId, bookingId);
    }

    if (payment.status !== 'pending') {
      throw new ApiError('CONFLICT', 'Deposit payment is not awaiting capture', 409);
    }

    const stripeStatus = await getStripeProvider().retrievePaymentIntentStatus(
      payment.stripePaymentIntentId,
    );
    if (stripeStatus !== 'succeeded') {
      throw new ApiError('CONFLICT', 'Deposit payment has not succeeded yet', 409);
    }

    return this.capturePaymentFromWebhook(payment.stripePaymentIntentId, bookingId);
  }

  async createBalanceCharge(clientId: string, bookingId: string): Promise<DepositPaymentResponse> {
    const booking = await bookingService.getBookingForClient(clientId, bookingId);

    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new ApiError('CONFLICT', 'Balance can only be paid for confirmed bookings', 409);
    }
    if (booking.depositStatus !== 'paid') {
      throw new ApiError('CONFLICT', 'Deposit must be paid before paying the remaining balance', 409);
    }
    if (booking.balanceStatus === 'paid_online' || booking.balanceStatus === 'paid_in_person') {
      throw new ApiError('CONFLICT', 'Balance has already been paid for this booking', 409);
    }
    if (booking.balanceStatus !== 'due') {
      throw new ApiError('CONFLICT', 'No remaining balance is due for this booking', 409);
    }

    const balanceAmount = Number(booking.balanceAmount);
    if (balanceAmount <= 0) {
      throw ApiError.validation('Balance amount must be greater than zero');
    }

    const profile = await prisma.stylistProfile.findUnique({
      where: { id: booking.stylistId },
      select: { businessId: true },
    });
    if (!profile?.businessId) {
      throw ApiError.notFound('Business not found for booking');
    }
    if (!(await isBusinessPaymentReady(profile.businessId))) {
      throw new ApiError('CONFLICT', 'Stylist has not completed Stripe Connect onboarding', 422);
    }

    const stripe = getStripeProvider();
    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId_kind: { bookingId, kind: 'balance' } },
    });
    if (existingPayment) {
      if (existingPayment.status === 'pending') {
        if (isStaleMockPaymentIntent(existingPayment.stripePaymentIntentId)) {
          await prisma.payment.delete({ where: { id: existingPayment.id } });
        } else {
          const intent = await stripe.retrieveDepositPaymentIntent(
            existingPayment.stripePaymentIntentId,
          );
          return {
            id: existingPayment.id,
            bookingId: existingPayment.bookingId,
            kind: 'balance',
            stripePaymentIntentId: existingPayment.stripePaymentIntentId,
            clientSecret: intent.clientSecret,
            amount: existingPayment.amount.toFixed(2),
            currency: existingPayment.currency,
            status: existingPayment.status,
          };
        }
      } else if (isTerminalPaymentStatus(existingPayment.status)) {
        throw new ApiError('CONFLICT', 'A balance payment already exists for this booking', 409);
      }
    }

    const connectAccount = await prisma.paymentAccount.findUnique({
      where: { businessId: profile.businessId },
    });
    if (!connectAccount?.chargesEnabled) {
      throw new ApiError('CONFLICT', 'Stylist has not completed Stripe Connect onboarding', 422);
    }
    if (
      !allowsMockConnectAccount() &&
      isStaleMockConnectAccount(connectAccount.stripeConnectAccountId)
    ) {
      throw new ApiError(
        'CONFLICT',
        'Stylist must reconnect Stripe — previous setup used development mock accounts',
        422,
      );
    }

    if (!booking.clientId) {
      throw ApiError.validation('Booking has no client — balance payments require a linked client');
    }

    const amountPence = toPence(balanceAmount);
    const intent = await stripe.createDepositPaymentIntent({
      bookingId: booking.id,
      amountPence,
      currency: 'gbp',
      connectedAccountId: connectAccount.stripeConnectAccountId,
      stylistId: booking.stylistId,
      clientId: booking.clientId,
      paymentKind: 'balance',
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: 'balance',
        stripePaymentIntentId: intent.paymentIntentId,
        amount: balanceAmount,
        currency: 'gbp',
        status: 'pending',
      },
    });

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      kind: 'balance',
      stripePaymentIntentId: payment.stripePaymentIntentId,
      clientSecret: intent.clientSecret,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status,
    };
  }

  async syncBalanceAfterClientCheckout(
    clientId: string,
    bookingId: string,
  ): Promise<{ payment: PaymentDto; balancePaid: boolean }> {
    await bookingService.getBookingForClient(clientId, bookingId);

    const payment = await prisma.payment.findUnique({
      where: { bookingId_kind: { bookingId, kind: 'balance' } },
    });
    if (!payment) {
      throw ApiError.notFound('Balance payment not found');
    }

    if (payment.status === 'captured') {
      return this.capturePaymentFromWebhook(payment.stripePaymentIntentId, bookingId).then(
        (result) => ({
          payment: result.payment,
          balancePaid: true,
        }),
      );
    }

    if (payment.status !== 'pending') {
      throw new ApiError('CONFLICT', 'Balance payment is not awaiting capture', 409);
    }

    const stripeStatus = await getStripeProvider().retrievePaymentIntentStatus(
      payment.stripePaymentIntentId,
    );
    if (stripeStatus !== 'succeeded') {
      throw new ApiError('CONFLICT', 'Balance payment has not succeeded yet', 409);
    }

    const result = await this.capturePaymentFromWebhook(payment.stripePaymentIntentId, bookingId);
    return { payment: result.payment, balancePaid: true };
  }

  /** @deprecated Prefer capturePaymentFromWebhook — retained for call sites/tests. */
  async captureDepositFromWebhook(
    paymentIntentId: string,
    bookingId: string,
  ): Promise<{ payment: PaymentDto; bookingConfirmed: boolean }> {
    return this.capturePaymentFromWebhook(paymentIntentId, bookingId);
  }

  async capturePaymentFromWebhook(
    paymentIntentId: string,
    bookingId: string,
  ): Promise<{ payment: PaymentDto; bookingConfirmed: boolean }> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      throw ApiError.notFound('Payment not found for PaymentIntent');
    }

    if (payment.bookingId !== bookingId) {
      throw ApiError.validation('PaymentIntent booking metadata does not match payment record');
    }

    if (payment.kind === 'balance') {
      return this.captureBalancePayment(payment);
    }

    if (payment.status === 'captured') {
      const result = await bookingService.confirmBooking(bookingId);
      if (result.outcome === 'hold_expired') {
        await this.processRefund(bookingId, 'full');
        return { payment: toPayment(payment), bookingConfirmed: false };
      }
      return {
        payment: toPayment(payment),
        bookingConfirmed: result.booking.status === 'confirmed',
      };
    }

    const captured = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'captured',
        capturedAt: new Date(),
      },
    });

    const result = await bookingService.confirmBooking(bookingId);
    if (result.outcome === 'hold_expired') {
      await this.processRefund(bookingId, 'full');
      return { payment: toPayment(captured), bookingConfirmed: false };
    }

    return {
      payment: toPayment(captured),
      bookingConfirmed: result.booking.status === 'confirmed',
    };
  }

  private async captureBalancePayment(payment: {
    id: string;
    bookingId: string;
    status: string;
  }): Promise<{ payment: PaymentDto; bookingConfirmed: boolean }> {
    if (payment.status === 'captured') {
      const existing = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      return { payment: toPayment(existing), bookingConfirmed: false };
    }

    const captured = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'captured',
          capturedAt: new Date(),
        },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          balanceStatus: 'paid_online',
          balancePaidAt: new Date(),
        },
      });
      return updated;
    });

    return { payment: toPayment(captured), bookingConfirmed: false };
  }

  /**
   * Ch.9.3 — full refunds all captured online payments (deposit + balance).
   * Partial refunds deposit only. Forfeit keeps deposit and still refunds any online balance.
   */
  async processRefund(
    bookingId: string,
    refundType: 'full' | 'partial' | 'none',
    partialAmount?: number,
  ): Promise<PaymentDto | null> {
    const capturedPayments = await prisma.payment.findMany({
      where: { bookingId, status: 'captured' },
      orderBy: { createdAt: 'asc' },
    });
    if (capturedPayments.length === 0) {
      return null;
    }

    const depositPayment = capturedPayments.find((p) => p.kind === 'deposit') ?? null;
    const balancePayment = capturedPayments.find((p) => p.kind === 'balance') ?? null;

    if (refundType === 'none') {
      // Forfeit deposit policy — still refund any online balance the client paid.
      if (balancePayment) {
        await getStripeProvider().createRefund({
          paymentIntentId: balancePayment.stripePaymentIntentId,
        });
      }

      const forfeited = await prisma.$transaction(async (tx) => {
        let depositResult = depositPayment;
        if (depositPayment) {
          depositResult = await tx.payment.update({
            where: { id: depositPayment.id },
            data: { status: 'forfeited' },
          });
        }
        if (balancePayment) {
          await tx.payment.update({
            where: { id: balancePayment.id },
            data: {
              status: 'refunded',
              refundedAmount: balancePayment.amount,
            },
          });
        }
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            depositStatus: 'forfeited',
            ...(balancePayment
              ? { balanceStatus: 'not_due' as const, balancePaidAt: null }
              : {}),
          },
        });
        return depositResult;
      });
      return forfeited ? toPayment(forfeited) : null;
    }

    if (refundType === 'partial') {
      if (!depositPayment) {
        return null;
      }
      const capturedPence = toPence(depositPayment.amount);
      const refundPence = toPence(partialAmount ?? 0);
      if (refundPence <= 0 || refundPence > capturedPence) {
        throw ApiError.validation('Refund amount must be between zero and the captured deposit');
      }

      await getStripeProvider().createRefund({
        paymentIntentId: depositPayment.stripePaymentIntentId,
        amountPence: refundPence,
      });

      const refunded = await prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: depositPayment.id },
          data: {
            status: 'refunded',
            refundedAmount: refundPence / 100,
          },
        });
        await tx.booking.update({
          where: { id: bookingId },
          data: { depositStatus: 'refunded' },
        });
        return updated;
      });
      return toPayment(refunded);
    }

    // Full refund — every captured online payment
    const stripe = getStripeProvider();
    for (const payment of capturedPayments) {
      await stripe.createRefund({ paymentIntentId: payment.stripePaymentIntentId });
    }

    const refunded = await prisma.$transaction(async (tx) => {
      let depositResult = depositPayment;
      for (const payment of capturedPayments) {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
            refundedAmount: payment.amount,
          },
        });
        if (payment.kind === 'deposit') {
          depositResult = updated;
        }
      }
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          depositStatus: 'refunded',
          ...(balancePayment
            ? { balanceStatus: 'not_due' as const, balancePaidAt: null }
            : {}),
        },
      });
      return depositResult;
    });

    return refunded ? toPayment(refunded) : toPayment(capturedPayments[0]!);
  }

  async processPartialRefundForStylist(
    stylistId: string,
    bookingId: string,
    amount: number,
  ): Promise<PaymentDto> {
    await bookingService.getBooking(stylistId, bookingId);
    const result = await this.processRefund(bookingId, 'partial', amount);
    if (!result) {
      throw new ApiError('CONFLICT', 'No captured deposit available to refund', 409);
    }
    return result;
  }

  /** Ch.9.4 — never regress captured payments on out-of-order failure webhooks. */
  async markPaymentFailed(paymentIntentId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment || payment.status !== 'pending') {
      return;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
  }

  async listPayoutHistory(businessId: string): Promise<PayoutHistoryItem[]> {
    const account = await prisma.paymentAccount.findUnique({
      where: { businessId },
    });
    if (!account) {
      return [];
    }

    const payouts = await getStripeProvider().listPayouts(account.stripeConnectAccountId);
    return payouts.map((payout) => ({
      id: payout.id,
      amount: (payout.amount / 100).toFixed(2),
      currency: payout.currency,
      status: payout.status,
      arrivalDate: payout.arrivalDate,
      createdAt: payout.createdAt,
    }));
  }

  async getIncomeReport(businessId: string, from?: string, to?: string): Promise<IncomeReport> {
    const profile = await prisma.stylistProfile.findFirst({
      where: { businessId },
      select: { id: true },
    });
    if (!profile) {
      throw ApiError.notFound('Business not found');
    }

    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();

    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          stylistId: profile.id,
          startTime: { gte: fromDate, lte: toDate },
        },
      },
      include: {
        booking: { select: { status: true } },
      },
    });

    let totalCaptured = 0;
    let totalForfeited = 0;
    let totalRefunded = 0;
    const completedBookingIds = new Set<string>();
    const noShowBookingIds = new Set<string>();

    for (const payment of payments) {
      const amount = payment.amount.toNumber();
      if (payment.status === 'captured') {
        totalCaptured += amount;
      }
      if (payment.status === 'forfeited') {
        totalForfeited += amount;
      }
      if (payment.status === 'refunded') {
        totalRefunded += payment.refundedAmount?.toNumber() ?? amount;
      }
      if (payment.booking.status === 'completed') {
        completedBookingIds.add(payment.bookingId);
      }
      if (payment.booking.status === 'no_show') {
        noShowBookingIds.add(payment.bookingId);
      }
    }

    return {
      businessId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalCaptured: totalCaptured.toFixed(2),
      totalForfeited: totalForfeited.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      completedBookings: completedBookingIds.size,
      noShowBookings: noShowBookingIds.size,
    };
  }

  /** Ch.9.6 — assemble dispute evidence with extension point for Ch.11/13 conversation history. */
  async assembleDisputeEvidence(bookingId: string): Promise<{
    isComplete: boolean;
    evidence: Prisma.JsonObject;
    paymentId: string;
  }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    const depositPayment =
      booking?.payments.find((p) => p.kind === 'deposit' && p.status === 'captured') ??
      booking?.payments.find((p) => p.kind === 'deposit') ??
      null;
    if (!booking || !depositPayment) {
      throw ApiError.notFound('Captured payment not found for booking');
    }

    const policySnapshot = booking.policySnapshot as Prisma.JsonObject | null;
    const hasPolicySnapshot = policySnapshot !== null && Object.keys(policySnapshot).length > 0;

    const evidence: Prisma.JsonObject = {
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        agreedPrice: booking.agreedPrice.toString(),
        depositAmount: booking.depositAmount.toString(),
        createdAt: booking.createdAt.toISOString(),
        cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      },
      policySnapshot: policySnapshot ?? null,
      // Extension point (Ch.11/13): attach SMS / AI receptionist conversation excerpts here.
      conversationHistory: null,
    };

    const isComplete = hasPolicySnapshot;

    const record = await prisma.disputeEvidencePackage.create({
      data: {
        paymentId: depositPayment.id,
        bookingId: booking.id,
        evidenceData: evidence,
        isComplete,
      },
    });

    return {
      isComplete: record.isComplete,
      evidence,
      paymentId: depositPayment.id,
    };
  }

  async handleDisputeCreated(paymentIntentId: string, disputeId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) {
      return;
    }

    const assembled = await this.assembleDisputeEvidence(payment.bookingId);
    if (!assembled.isComplete) {
      return;
    }

    await getStripeProvider().submitDisputeEvidence({
      disputeId,
      evidence: {
        cancellation_policy: JSON.stringify(assembled.evidence.policySnapshot),
        customer_communication: 'Booking confirmed via Project Braids platform.',
      },
    });

    await prisma.disputeEvidencePackage.updateMany({
      where: { paymentId: payment.id, submittedToStripeAt: null },
      data: { submittedToStripeAt: new Date() },
    });
  }

  async reconcileRecentPayments(
    limit = 25,
  ): Promise<
    Array<{ paymentId: string; bookingId: string; localStatus: string; stripeStatus: string }>
  > {
    const stripe = getStripeProvider();
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const mismatches: Array<{
      paymentId: string;
      bookingId: string;
      localStatus: string;
      stripeStatus: string;
    }> = [];

    for (const payment of payments) {
      const stripeStatus = await stripe.retrievePaymentIntentStatus(payment.stripePaymentIntentId);
      const expectedLocal =
        stripeStatus === 'succeeded'
          ? 'captured'
          : stripeStatus === 'failed'
            ? 'failed'
            : stripeStatus === 'canceled'
              ? 'refunded'
              : 'pending';

      if (
        payment.status !== expectedLocal &&
        !(payment.status === 'refunded' && stripeStatus === 'canceled') &&
        !(payment.status === 'forfeited' && stripeStatus === 'succeeded')
      ) {
        mismatches.push({
          paymentId: payment.id,
          bookingId: payment.bookingId,
          localStatus: payment.status,
          stripeStatus,
        });
      }
    }

    return mismatches;
  }

  async simulateDepositSuccess(bookingId: string, clientId: string): Promise<PaymentDto> {
    if (!allowsMockConnectAccount()) {
      throw new ApiError(
        'FORBIDDEN',
        'Deposit simulation is only available in Stripe mock mode',
        403,
      );
    }

    const booking = await bookingService.getBookingForClient(clientId, bookingId);
    await this.ensureMockConnectReady(booking.stylistId);

    let payment = await prisma.payment.findFirst({
      where: { bookingId, kind: 'deposit', status: 'pending' },
    });

    if (!payment) {
      await this.createDepositCharge(clientId, bookingId);
      payment = await prisma.payment.findFirst({
        where: { bookingId, kind: 'deposit', status: 'pending' },
      });
    }

    if (!payment) {
      throw ApiError.internal('Failed to prepare pending deposit for simulation');
    }

    const result = await this.captureDepositFromWebhook(
      payment.stripePaymentIntentId,
      payment.bookingId,
    );
    return result.payment;
  }

  private async ensureMockConnectReady(stylistId: string): Promise<void> {
    if (!allowsMockConnectAccount()) {
      return;
    }

    const mock = getMockStripeProvider();
    if (!mock) {
      return;
    }

    const profile = await prisma.stylistProfile.findUnique({
      where: { id: stylistId },
      select: { businessId: true },
    });
    if (!profile?.businessId) {
      return;
    }

    const stripe = getStripeProvider();
    const account = await prisma.paymentAccount.findUnique({
      where: { businessId: profile.businessId },
    });

    if (!account) {
      const created = await stripe.createConnectAccount({ stylistId });
      mock.markConnectAccountReady(created.stripeAccountId);
      await prisma.paymentAccount.create({
        data: {
          businessId: profile.businessId,
          stripeConnectAccountId: created.stripeAccountId,
          onboardingStatus: 'complete',
          chargesEnabled: true,
          payoutsEnabled: true,
        },
      });
      return;
    }

    if (!account.chargesEnabled) {
      mock.markConnectAccountReady(account.stripeConnectAccountId);
      await prisma.paymentAccount.update({
        where: { businessId: profile.businessId },
        data: {
          chargesEnabled: true,
          payoutsEnabled: true,
          onboardingStatus: 'complete',
        },
      });
    }
  }
}

export const paymentService = new PaymentService();
