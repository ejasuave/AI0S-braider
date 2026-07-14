import { z } from 'zod';

export const PAYMENT_STATUSES = ['pending', 'captured', 'refunded', 'forfeited', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_KINDS = ['deposit', 'balance'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_ONBOARDING_STATUSES = [
  'not_started',
  'in_progress',
  'complete',
  'restricted',
] as const;
export type PaymentOnboardingStatus = (typeof PAYMENT_ONBOARDING_STATUSES)[number];

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

export const stripeConnectStatusSchema = connectStatusResponseSchema.extend({
  onboardingStatus: z.enum(PAYMENT_ONBOARDING_STATUSES),
});

export type StripeConnectStatus = z.infer<typeof stripeConnectStatusSchema>;

export const createDepositPaymentRequestSchema = z.object({
  bookingId: z.string().uuid(),
});

export type CreateDepositPaymentRequest = z.infer<typeof createDepositPaymentRequestSchema>;

export const depositPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  kind: z.enum(PAYMENT_KINDS),
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
  kind: z.enum(PAYMENT_KINDS),
  stripePaymentIntentId: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(PAYMENT_STATUSES),
  createdAt: z.string().datetime(),
  capturedAt: z.string().datetime().nullable(),
  refundedAmount: z.string().nullable().optional(),
  /** Present when status is `pending` — required to resume Stripe checkout. */
  clientSecret: z.string().optional(),
});

export type Payment = z.infer<typeof paymentSchema>;

export const createBalancePaymentRequestSchema = z.object({
  bookingId: z.string().uuid(),
});

export type CreateBalancePaymentRequest = z.infer<typeof createBalancePaymentRequestSchema>;

export const syncDepositResponseSchema = z.object({
  payment: paymentSchema,
  bookingConfirmed: z.boolean(),
});

export type SyncDepositResponse = z.infer<typeof syncDepositResponseSchema>;

export const syncBalanceResponseSchema = z.object({
  payment: paymentSchema,
  balancePaid: z.boolean(),
});

export type SyncBalanceResponse = z.infer<typeof syncBalanceResponseSchema>;

export const partialRefundRequestSchema = z.object({
  amount: z.number().positive(),
});

export type PartialRefundRequest = z.infer<typeof partialRefundRequestSchema>;

export const payoutHistoryItemSchema = z.object({
  id: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.string(),
  arrivalDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type PayoutHistoryItem = z.infer<typeof payoutHistoryItemSchema>;

export const incomeReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type IncomeReportQuery = z.infer<typeof incomeReportQuerySchema>;

export const incomeReportSchema = z.object({
  businessId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  totalCaptured: z.string(),
  totalForfeited: z.string(),
  totalRefunded: z.string(),
  completedBookings: z.number().int().nonnegative(),
  noShowBookings: z.number().int().nonnegative(),
});

export type IncomeReport = z.infer<typeof incomeReportSchema>;
