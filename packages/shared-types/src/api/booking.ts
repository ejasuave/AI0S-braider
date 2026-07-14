import { z } from 'zod';

export const BOOKING_STATUSES = ['held', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_DEPOSIT_STATUSES = ['pending', 'paid', 'refunded', 'forfeited'] as const;
export type BookingDepositStatus = (typeof BOOKING_DEPOSIT_STATUSES)[number];

export const BOOKING_SOURCES = ['ai_agent', 'dashboard_manual', 'client_direct'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const DEPOSIT_DISPOSITIONS = ['full_refund', 'forfeit_deposit', 'no_action'] as const;
export type DepositDisposition = (typeof DEPOSIT_DISPOSITIONS)[number];

export const CALENDAR_CONFLICT_RESOLUTIONS = [
  'kept_platform_booking',
  'kept_external_event',
  'manual_other',
] as const;
export type CalendarConflictResolution = (typeof CALENDAR_CONFLICT_RESOLUTIONS)[number];

export const bookingSchema = z.object({
  id: z.string().uuid(),
  stylistId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  serviceOfferingId: z.string().uuid().nullable(),
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
  stylistApprovedAt: z.string().datetime().nullable(),
  pendingStylistApproval: z.boolean().optional(),
});

export type Booking = z.infer<typeof bookingSchema>;

export const createBookingHoldRequestSchema = z.object({
  stylistId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  startTime: z.string().datetime(),
  source: z.enum(BOOKING_SOURCES).default('client_direct'),
});

export type CreateBookingHoldRequest = z.infer<typeof createBookingHoldRequestSchema>;

export const createManualBookingRequestSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    serviceOfferingId: z.string().uuid().optional(),
    startTime: z.string().datetime(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.serviceOfferingId && !value.durationMinutes) {
      ctx.addIssue({
        code: 'custom',
        message: 'durationMinutes is required when serviceOfferingId is omitted',
        path: ['durationMinutes'],
      });
    }
  });

export type CreateManualBookingRequest = z.infer<typeof createManualBookingRequestSchema>;

export const cancelBookingRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CancelBookingRequest = z.infer<typeof cancelBookingRequestSchema>;

export const bookingActionResultSchema = z.object({
  booking: bookingSchema,
  depositDisposition: z.enum(DEPOSIT_DISPOSITIONS),
});

export type BookingActionResult = z.infer<typeof bookingActionResultSchema>;

export const confirmBookingResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('confirmed'),
    booking: bookingSchema,
  }),
  z.object({
    outcome: z.literal('hold_expired'),
    booking: bookingSchema,
    refundRequired: z.literal(true),
  }),
]);

export type ConfirmBookingResult = z.infer<typeof confirmBookingResultSchema>;

export const bookingListQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  segment: z.enum(['upcoming', 'past', 'cancelled']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;

export const calendarConflictSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  bookingId: z.string().uuid().nullable(),
  externalEventId: z.string(),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolution: z.enum(CALENDAR_CONFLICT_RESOLUTIONS).nullable(),
});

export type CalendarConflict = z.infer<typeof calendarConflictSchema>;

export const resolveCalendarConflictRequestSchema = z.object({
  resolution: z.enum(CALENDAR_CONFLICT_RESOLUTIONS),
});

export type ResolveCalendarConflictRequest = z.infer<typeof resolveCalendarConflictRequestSchema>;
