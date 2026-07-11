import { z } from 'zod';

export const PAYMENT_STATUSES = ['pending', 'captured', 'refunded', 'forfeited', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const connectOnboardingResponseSchema = z.object({
  stripeAccountId: z.string(),
  onboardingUrl: z.string().url(),
});

export type ConnectOnboardingResponse = z.infer<typeof connectOnboardingResponseSchema>;

export const connectStatusResponseSchema = z.object({
  connected: z.boolean(),
  stripeAccountId: z.string().nullable(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  onboardingComplete: z.boolean(),
});

export type ConnectStatusResponse = z.infer<typeof connectStatusResponseSchema>;

export const createDepositPaymentRequestSchema = z.object({
  bookingId: z.string().uuid(),
});

export type CreateDepositPaymentRequest = z.infer<typeof createDepositPaymentRequestSchema>;

export const depositPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  stripePaymentIntentId: z.string(),
  clientSecret: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(PAYMENT_STATUSES),
});

export type DepositPaymentResponse = z.infer<typeof depositPaymentResponseSchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  stripePaymentIntentId: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(PAYMENT_STATUSES),
  createdAt: z.string().datetime(),
  capturedAt: z.string().datetime().nullable(),
});

export type Payment = z.infer<typeof paymentSchema>;
