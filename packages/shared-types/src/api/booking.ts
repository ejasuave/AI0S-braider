import { z } from 'zod';

export const BOOKING_STATUSES = ['held', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_DEPOSIT_STATUSES = ['pending', 'paid', 'refunded', 'forfeited'] as const;
export type BookingDepositStatus = (typeof BOOKING_DEPOSIT_STATUSES)[number];

export const BOOKING_SOURCES = ['ai_agent', 'dashboard_manual', 'client_direct'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const bookingSchema = z.object({
  id: z.string().uuid(),
  stylistId: z.string().uuid(),
  clientId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  status: z.enum(BOOKING_STATUSES),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  agreedPrice: z.string(),
  agreedDurationMinutes: z.number().int().positive(),
  depositAmount: z.string(),
  depositStatus: z.enum(BOOKING_DEPOSIT_STATUSES),
  holdExpiresAt: z.string().datetime().nullable(),
  source: z.enum(BOOKING_SOURCES),
  createdAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  cancellationReason: z.string().nullable(),
});

export type Booking = z.infer<typeof bookingSchema>;

export const createBookingHoldRequestSchema = z.object({
  stylistId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  startTime: z.string().datetime(),
  source: z.enum(BOOKING_SOURCES).default('client_direct'),
});

export type CreateBookingHoldRequest = z.infer<typeof createBookingHoldRequestSchema>;

export const createManualBookingRequestSchema = z.object({
  clientId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  startTime: z.string().datetime(),
  confirmImmediately: z.boolean().default(true),
});

export type CreateManualBookingRequest = z.infer<typeof createManualBookingRequestSchema>;

export const cancelBookingRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CancelBookingRequest = z.infer<typeof cancelBookingRequestSchema>;

export const bookingListQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;
