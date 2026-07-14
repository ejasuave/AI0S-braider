import { z } from 'zod';
import { availabilitySlotSchema } from './availability.js';

export const EXTERNAL_CALENDAR_PROVIDERS = ['google'] as const;
export type ExternalCalendarProvider = (typeof EXTERNAL_CALENDAR_PROVIDERS)[number];

export const EXTERNAL_CALENDAR_SYNC_STATUSES = ['synced', 'pending', 'failed'] as const;
export type ExternalCalendarSyncStatus = (typeof EXTERNAL_CALENDAR_SYNC_STATUSES)[number];

/** Ch.8.1 — public availability query for a business. */
export const businessAvailabilityQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    serviceOfferingId: z.string().uuid().optional(),
    durationMinutes: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).default(20),
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

export type BusinessAvailabilityQuery = z.infer<typeof businessAvailabilityQuerySchema>;

export const businessAvailabilityResponseSchema = z.object({
  businessId: z.string().uuid(),
  stylistId: z.string().uuid(),
  serviceOfferingId: z.string().uuid().nullable(),
  timezone: z.string(),
  slots: z.array(availabilitySlotSchema),
});

export type BusinessAvailabilityResponse = z.infer<typeof businessAvailabilityResponseSchema>;

export const updateSchedulingSettingsRequestSchema = z.object({
  bufferMinutes: z.number().int().min(0).max(240).optional(),
  requireStylistApproval: z.boolean().optional(),
});

export type UpdateSchedulingSettingsRequest = z.infer<typeof updateSchedulingSettingsRequestSchema>;

export const schedulingSettingsSchema = z.object({
  businessId: z.string().uuid(),
  bufferMinutes: z.number().int().min(0).max(240),
  requireStylistApproval: z.boolean(),
});

export type SchedulingSettings = z.infer<typeof schedulingSettingsSchema>;

export const calendarConnectionStatusSchema = z.object({
  connected: z.boolean(),
  provider: z.enum(EXTERNAL_CALENDAR_PROVIDERS).nullable(),
  calendarId: z.string().nullable(),
  subscriptionExpiresAt: z.string().datetime().nullable(),
  /** True when API is using MockGoogleCalendarApiClient (no GOOGLE_CLIENT_ID/SECRET). */
  mockMode: z.boolean(),
});

export type CalendarConnectionStatus = z.infer<typeof calendarConnectionStatusSchema>;

export const connectGoogleCalendarRequestSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().url(),
});

export type ConnectGoogleCalendarRequest = z.infer<typeof connectGoogleCalendarRequestSchema>;
