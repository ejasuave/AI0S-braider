import { z } from 'zod';
import { publicBookingOfferingSchema, publicPortfolioImageSchema } from './profile.js';

export const directorySearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  style: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
});

export type DirectorySearchQuery = z.infer<typeof directorySearchQuerySchema>;

export const directoryListingSchema = z.object({
  stylistId: z.string().uuid(),
  businessName: z.string(),
  locationArea: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  /** First image clients see on directory cards — profile photo preferred over portfolio. */
  coverImageUrl: z.string().url().nullable(),
  styleNames: z.array(z.string()),
  startingPrice: z.string().nullable(),
});

export type DirectoryListing = z.infer<typeof directoryListingSchema>;

export const directoryStylistDetailSchema = z.object({
  stylistId: z.string().uuid(),
  businessName: z.string(),
  locationArea: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  /** Public SMS booking number for AI receptionist (null if stylist has not set one). */
  smsBookingNumber: z.string().nullable(),
  portfolio: z.array(publicPortfolioImageSchema),
  offerings: z.array(publicBookingOfferingSchema),
});

export type DirectoryStylistDetail = z.infer<typeof directoryStylistDetailSchema>;

export const directorySearchResponseSchema = z.object({
  items: z.array(directoryListingSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type DirectorySearchResponse = z.infer<typeof directorySearchResponseSchema>;
