import { z } from 'zod';

export const availabilityQuerySchema = z.object({
  stylistId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const availabilitySlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().nonnegative(),
});

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityResponseSchema = z.object({
  stylistId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  timezone: z.string(),
  slots: z.array(availabilitySlotSchema),
});

export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;
