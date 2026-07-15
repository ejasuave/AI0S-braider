import { z } from 'zod';

export const SERVICE_VENUE_MODES = ['remote', 'stylist_location', 'come_to_client'] as const;
export type ServiceVenueMode = (typeof SERVICE_VENUE_MODES)[number];

export const BALANCE_STATUSES = ['not_due', 'due', 'paid_online', 'paid_in_person'] as const;
export type BalanceStatus = (typeof BALANCE_STATUSES)[number];

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

export const bookingAddonSnapshotSchema = z.object({
  serviceAddonId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string(),
});

export type BookingAddonSnapshot = z.infer<typeof bookingAddonSnapshotSchema>;

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
  serviceVenueMode: z.enum(SERVICE_VENUE_MODES),
  /** Workplace or client visit address; may be redacted for clients until confirmation. */
  venueAddress: z.string().nullable(),
  homeVisitSurcharge: z.string(),
  clientDisplayName: z.string().nullable(),
  /** Present for stylist audience when client is known. */
  clientPhoneNumber: z.string().nullable().optional(),
  balanceStatus: z.enum(BALANCE_STATUSES),
  balancePaidAt: z.string().datetime().nullable(),
  /** agreedPrice − depositAmount (the post-deposit remainder). */
  balanceAmount: z.string(),
  /** Amount still owed by the client (0 if balance paid or not yet due). */
  remainingToPay: z.string(),
  /** Deposit captured/kept + balance paid (online or in person). */
  totalPaid: z.string(),
  /** What the stylist should expect to keep for this booking at current payment state. */
  stylistExpectedTotal: z.string(),
  addons: z.array(bookingAddonSnapshotSchema).default([]),
  remainingBalanceMethod: z.enum(['cash', 'card', 'cash_or_card']).nullable(),
  requirementsAcknowledgedAt: z.string().datetime().nullable(),
  policiesAcknowledgedAt: z.string().datetime().nullable(),
  /** Client history — stylist display name (joined, not snapshotted). */
  stylistBusinessName: z.string().nullable().optional(),
  /** Client history — style/service name (joined; null if offering removed). */
  serviceStyleName: z.string().nullable().optional(),
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
  clientDisplayName: z.string().trim().min(1).max(80).optional(),
  /** Client-selected venue from the stylist's offered options. */
  serviceVenueMode: z.enum(SERVICE_VENUE_MODES).optional(),
  /** Required when the client chooses come_to_client. */
  clientVisitAddress: z.string().trim().min(5).max(500).optional(),
  /** Selected optional add-on ids for this service. */
  addonIds: z.array(z.string().uuid()).max(50).optional(),
  /** Required when the service has requirements (web/client_direct). */
  acknowledgedRequirements: z.boolean().optional(),
  /** Required before hold for client_direct — client accepts stylist policies. */
  acknowledgedPolicies: z.boolean().optional(),
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
