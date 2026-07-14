import { z } from 'zod';

export const clientProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable(),
  email: z.string().email().nullable(),
  phoneNumber: z.string(),
  updatedAt: z.string().datetime(),
});

export type ClientProfile = z.infer<typeof clientProfileSchema>;

export const updateClientProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().optional(),
});

export type UpdateClientProfileRequest = z.infer<typeof updateClientProfileRequestSchema>;

export const savedStylistSchema = z.object({
  stylistId: z.string().uuid(),
  businessName: z.string(),
  locationArea: z.string().nullable(),
  directoryVisible: z.boolean(),
  savedAt: z.string().datetime(),
});

export type SavedStylist = z.infer<typeof savedStylistSchema>;

export const saveStylistRequestSchema = z.object({
  stylistId: z.string().uuid(),
});

export type SaveStylistRequest = z.infer<typeof saveStylistRequestSchema>;

export const CLIENT_BOOKING_SEGMENTS = ['upcoming', 'past', 'cancelled'] as const;
export type ClientBookingSegment = (typeof CLIENT_BOOKING_SEGMENTS)[number];
