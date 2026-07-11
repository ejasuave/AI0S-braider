import type {
  ConnectOnboardingResponse,
  ConnectStatusResponse,
  DepositPaymentResponse,
  Payment as PaymentDto,
} from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import {
  getMockStripeProvider,
  getStripeProvider,
  isStripeMockMode,
} from '../../lib/stripe/index.js';
import { bookingService } from '../booking/service.js';
import { isTerminalPaymentStatus, toPayment, toPence } from './mappers.js';

export class PaymentService {
  async startConnectOnboarding(
    stylistId: string,
    email?: string,
  ): Promise<ConnectOnboardingResponse> {
    const env = getEnv();
    const stripe = getStripeProvider();

    const existing = await prisma.stylistStripeAccount.findUnique({
      where: { stylistId },
    });

    const stripeAccountId =
      existing?.stripeAccountId ??
      (await stripe.createConnectAccount({ stylistId, email })).stripeAccountId;

    if (!existing) {
      await prisma.stylistStripeAccount.create({
        data: {
          stylistId,
          stripeAccountId,
        },
      });
    }

    const link = await stripe.createConnectAccountLink({
      stripeAccountId,
      returnUrl: env.STRIPE_CONNECT_RETURN_URL,
      refreshUrl: env.STRIPE_CONNECT_REFRESH_URL,
    });

    return {
      stripeAccountId,
      onboardingUrl: link.url,
    };
  }

  async getConnectStatus(stylistId: string): Promise<ConnectStatusResponse> {
    const account = await prisma.stylistStripeAccount.findUnique({
      where: { stylistId },
    });

    if (!account) {
      return {
        connected: false,
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    const stripe = getStripeProvider();
    if (isStripeMockMode()) {
      getMockStripeProvider()?.markConnectAccountReady(account.stripeAccountId);
    }

    const stripeStatus = await stripe.retrieveConnectAccount(account.stripeAccountId);
    const synced = await this.syncConnectAccount(stylistId, stripeStatus);

    return {
      connected: synced.onboardingComplete && synced.chargesEnabled,
      stripeAccountId: synced.stripeAccountId,
      chargesEnabled: synced.chargesEnabled,
      payoutsEnabled: synced.payoutsEnabled,
      onboardingComplete: synced.onboardingComplete,
    };
  }

  async syncConnectAccount(
    stylistId: string,
    status: {
      stripeAccountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      onboardingComplete: boolean;
    },
  ) {
    return prisma.stylistStripeAccount.update({
      where: { stylistId },
      data: {
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        onboardingComplete: status.onboardingComplete,
      },
    });
  }

  async syncConnectAccountByStripeId(
    stripeAccountId: string,
    stripeObject?: Record<string, unknown>,
  ): Promise<void> {
    const account = await prisma.stylistStripeAccount.findUnique({
      where: { stripeAccountId },
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
        }
      : await getStripeProvider().retrieveConnectAccount(stripeAccountId);

    await this.syncConnectAccount(account.stylistId, status);
  }

  async createDepositPayment(clientId: string, bookingId: string): Promise<DepositPaymentResponse> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    if (booking.status !== 'held') {
      throw new ApiError('CONFLICT', 'Deposit can only be paid for held bookings', 409);
    }

    if (booking.depositStatus !== 'pending') {
      throw new ApiError('CONFLICT', 'Deposit has already been processed for this booking', 409);
    }

    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
      throw new ApiError('CONFLICT', 'Booking hold has expired', 409);
    }

    const stripe = getStripeProvider();

    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId },
    });
    if (existingPayment) {
      if (existingPayment.status === 'pending') {
        const intent = await stripe.retrieveDepositPaymentIntent(
          existingPayment.stripePaymentIntentId,
        );
        return {
          id: existingPayment.id,
          bookingId: existingPayment.bookingId,
          stripePaymentIntentId: existingPayment.stripePaymentIntentId,
          clientSecret: intent.clientSecret,
          amount: existingPayment.amount.toFixed(2),
          currency: existingPayment.currency,
          status: existingPayment.status,
        };
      }
      if (isTerminalPaymentStatus(existingPayment.status)) {
        throw new ApiError('CONFLICT', 'A payment already exists for this booking', 409);
      }
    }

    const connectAccount = await prisma.stylistStripeAccount.findUnique({
      where: { stylistId: booking.stylistId },
    });
    if (!connectAccount || !connectAccount.chargesEnabled) {
      throw new ApiError('CONFLICT', 'Stylist has not completed Stripe Connect onboarding', 422);
    }

    const amountPence = toPence(booking.depositAmount);
    if (amountPence <= 0) {
      throw ApiError.validation('Deposit amount must be greater than zero');
    }

    const intent = await stripe.createDepositPaymentIntent({
      bookingId: booking.id,
      amountPence,
      currency: 'gbp',
      connectedAccountId: connectAccount.stripeAccountId,
      stylistId: booking.stylistId,
      clientId: booking.clientId,
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripePaymentIntentId: intent.paymentIntentId,
        amount: booking.depositAmount,
        currency: 'gbp',
        status: 'pending',
      },
    });

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      clientSecret: intent.clientSecret,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status,
    };
  }

  async getPaymentForBooking(clientId: string, bookingId: string): Promise<PaymentDto> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const payment = await prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    return toPayment(payment);
  }

  async captureDepositFromWebhook(
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

    if (payment.status === 'captured') {
      const booking = await bookingService.confirmBookingAfterDeposit(bookingId);
      return { payment: toPayment(payment), bookingConfirmed: booking.status === 'confirmed' };
    }

    const captured = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'captured',
          capturedAt: new Date(),
        },
      });

      return updatedPayment;
    });

    const booking = await bookingService.confirmBookingAfterDeposit(bookingId);

    return {
      payment: toPayment(captured),
      bookingConfirmed: booking.status === 'confirmed',
    };
  }

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

  async simulateDepositSuccess(bookingId: string, clientId: string): Promise<PaymentDto> {
    if (!isStripeMockMode()) {
      throw new ApiError(
        'FORBIDDEN',
        'Deposit simulation is only available in Stripe mock mode',
        403,
      );
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, clientId },
    });
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    await this.ensureMockConnectReady(booking.stylistId);

    let payment = await prisma.payment.findFirst({
      where: {
        bookingId,
        status: 'pending',
      },
    });

    if (!payment) {
      await this.createDepositPayment(clientId, bookingId);
      payment = await prisma.payment.findFirst({
        where: {
          bookingId,
          status: 'pending',
        },
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
    if (!isStripeMockMode()) {
      return;
    }

    const mock = getMockStripeProvider();
    if (!mock) {
      return;
    }

    const stripe = getStripeProvider();
    const account = await prisma.stylistStripeAccount.findUnique({
      where: { stylistId },
    });

    if (!account) {
      const created = await stripe.createConnectAccount({ stylistId });
      mock.markConnectAccountReady(created.stripeAccountId);
      await prisma.stylistStripeAccount.create({
        data: {
          stylistId,
          stripeAccountId: created.stripeAccountId,
          chargesEnabled: true,
          payoutsEnabled: true,
          onboardingComplete: true,
        },
      });
      return;
    }

    if (!account.chargesEnabled) {
      mock.markConnectAccountReady(account.stripeAccountId);
      await prisma.stylistStripeAccount.update({
        where: { stylistId },
        data: {
          chargesEnabled: true,
          payoutsEnabled: true,
          onboardingComplete: true,
        },
      });
    }
  }
}

export const paymentService = new PaymentService();
