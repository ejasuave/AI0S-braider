import { z } from 'zod';
import { SERVICE_VENUE_MODES } from './booking.js';

export const ONBOARDING_STATUSES = ['in_progress', 'complete'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const PORTFOLIO_SOURCES = ['manual', 'instagram'] as const;
export type PortfolioSource = (typeof PORTFOLIO_SOURCES)[number];

export const DEPOSIT_POLICY_TYPES = ['flat', 'percent'] as const;
export type DepositPolicyType = (typeof DEPOSIT_POLICY_TYPES)[number];

export const CANCELLATION_FEE_TYPES = ['flat', 'percent', 'none'] as const;
export type CancellationFeeType = (typeof CANCELLATION_FEE_TYPES)[number];

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

export const workingDaySchema = z.object({
  enabled: z.boolean(),
  start: timeStringSchema,
  end: timeStringSchema,
});

export const workingHoursSchema = z
  .record(workingDaySchema)
  .refine(
    (value) => Object.keys(value).every((key) => WEEKDAYS.includes(key as Weekday)),
    'Invalid weekday key in working hours',
  );

export const depositPolicySchema = z.object({
  type: z.enum(DEPOSIT_POLICY_TYPES),
  value: z.number().positive(),
});

export const cancellationPolicySchema = z.object({
  windowHours: z.number().int().nonnegative(),
  feeType: z.enum(CANCELLATION_FEE_TYPES),
  feeAmount: z.number().nonnegative(),
  noShowFeeAmount: z.number().nonnegative(),
});

export const DEFAULT_DEPOSIT_POLICY = {
  type: 'percent' as const,
  value: 20,
};

export const DEFAULT_CANCELLATION_POLICY = {
  windowHours: 24,
  feeType: 'percent' as const,
  feeAmount: 50,
  noShowFeeAmount: 100,
};

export const DEFAULT_WORKING_HOURS: Record<Weekday, z.infer<typeof workingDaySchema>> = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: true, start: '10:00', end: '16:00' },
  sunday: { enabled: false, start: '10:00', end: '16:00' },
};

export const stylistProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  businessName: z.string(),
  bio: z.string().nullable(),
  locationArea: z.string().nullable(),
  serviceAreaRadiusKm: z.number().nullable(),
  cancellationPolicy: cancellationPolicySchema.nullable(),
  depositPolicy: depositPolicySchema.nullable(),
  workingHours: workingHoursSchema.nullable(),
  bufferMinutes: z.number().int().nonnegative(),
  onboardingStatus: z.enum(ONBOARDING_STATUSES),
  directoryVisible: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StylistProfile = z.infer<typeof stylistProfileSchema>;

export const updateStylistProfileRequestSchema = z
  .object({
    businessName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    locationArea: z.string().trim().max(120).nullable().optional(),
    serviceAreaRadiusKm: z.number().positive().max(200).nullable().optional(),
    cancellationPolicy: cancellationPolicySchema.optional(),
    depositPolicy: depositPolicySchema.optional(),
    workingHours: workingHoursSchema.optional(),
    bufferMinutes: z.number().int().min(0).max(240).optional(),
    onboardingStatus: z.enum(ONBOARDING_STATUSES).optional(),
    directoryVisible: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateStylistProfileRequest = z.infer<typeof updateStylistProfileRequestSchema>;

export const publicBookingOfferingSchema = z.object({
  id: z.string().uuid(),
  styleName: z.string(),
  basePrice: z.string(),
  estimatedDurationMinutes: z.number().int().positive(),
});

export const publicBookingPageSchema = z.object({
  businessId: z.string().uuid().nullable(),
  stylistId: z.string().uuid(),
  businessName: z.string(),
  locationArea: z.string().nullable(),
  serviceVenueMode: z.enum(SERVICE_VENUE_MODES),
  homeVisitSurcharge: z.string().nullable(),
  offerings: z.array(publicBookingOfferingSchema),
});

export type PublicBookingPage = z.infer<typeof publicBookingPageSchema>;

export const serviceOfferingSchema = z.object({
  id: z.string().uuid(),
  stylistId: z.string().uuid(),
  styleName: z.string(),
  sizeTier: z.string().nullable(),
  lengthTier: z.string().nullable(),
  basePrice: z.string(),
  estimatedDurationMinutes: z.number().int().positive(),
  hairIncluded: z.boolean(),
  isCustomStyle: z.boolean(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ServiceOffering = z.infer<typeof serviceOfferingSchema>;

export const createServiceOfferingRequestSchema = z.object({
  styleName: z.string().trim().min(1).max(120),
  sizeTier: z.string().trim().min(1).max(60).nullable().optional(),
  lengthTier: z.string().trim().min(1).max(60).nullable().optional(),
  basePrice: z.number().positive().max(100_000),
  estimatedDurationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  hairIncluded: z.boolean().optional(),
  isCustomStyle: z.boolean().optional(),
});

export type CreateServiceOfferingRequest = z.infer<typeof createServiceOfferingRequestSchema>;

export const updateServiceOfferingRequestSchema = createServiceOfferingRequestSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateServiceOfferingRequest = z.infer<typeof updateServiceOfferingRequestSchema>;

export const portfolioItemSchema = z.object({
  id: z.string().uuid(),
  stylistId: z.string().uuid(),
  imageUrl: z.string().url(),
  source: z.enum(PORTFOLIO_SOURCES),
  displayOrder: z.number().int(),
  createdAt: z.string().datetime(),
});

export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

export const createPortfolioItemRequestSchema = z.object({
  imageUrl: z.string().url().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type CreatePortfolioItemRequest = z.infer<typeof createPortfolioItemRequestSchema>;

export const updatePortfolioItemRequestSchema = z
  .object({
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdatePortfolioItemRequest = z.infer<typeof updatePortfolioItemRequestSchema>;

export const styleCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  sizeTiers: z.array(z.string()),
  lengthTiers: z.array(z.string()),
  sortOrder: z.number().int(),
});

export type StyleCategory = z.infer<typeof styleCategorySchema>;

export const pricingLookupRequestSchema = z.object({
  styleName: z.string().trim().min(1),
  sizeTier: z.string().trim().min(1).optional(),
  lengthTier: z.string().trim().min(1).optional(),
});

export type PricingLookupRequest = z.infer<typeof pricingLookupRequestSchema>;

export const PRICING_LOOKUP_MATCH_TYPES = [
  'exact',
  'partial_size',
  'partial_style',
  'none',
] as const;
export type PricingLookupMatchType = (typeof PRICING_LOOKUP_MATCH_TYPES)[number];

export const pricingLookupResponseSchema = z.object({
  offering: serviceOfferingSchema.nullable(),
  confidence: z.number().min(0).max(1),
  matchType: z.enum(PRICING_LOOKUP_MATCH_TYPES),
});

export type PricingLookupResponse = z.infer<typeof pricingLookupResponseSchema>;
