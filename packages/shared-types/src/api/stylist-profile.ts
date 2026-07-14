import { z } from 'zod';
import { ONBOARDING_STATUSES } from './profile.js';

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

export const businessProfileSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  businessName: z.string(),
  bio: z.string().nullable(),
  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  locationLabel: z.string().nullable(),
  serviceAreaRadiusKm: z.number().nullable(),
  offersStylistLocation: z.boolean(),
  offersComeToClient: z.boolean(),
  offersRemote: z.boolean(),
  workplaceAddress: z.string().nullable(),
  homeVisitSurcharge: z.string().nullable(),
  onboardingStatus: z.enum(ONBOARDING_STATUSES),
  stylistId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const updateBusinessProfileRequestSchema = z
  .object({
    businessName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    locationLat: z.number().min(-90).max(90).nullable().optional(),
    locationLng: z.number().min(-180).max(180).nullable().optional(),
    locationLabel: z.string().trim().max(120).nullable().optional(),
    serviceAreaRadiusKm: z.number().positive().max(200).nullable().optional(),
    offersStylistLocation: z.boolean().optional(),
    offersComeToClient: z.boolean().optional(),
    offersRemote: z.boolean().optional(),
    workplaceAddress: z.string().trim().min(5).max(500).nullable().optional(),
    homeVisitSurcharge: z.number().min(0).max(10_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .superRefine((value, ctx) => {
    const offersTouched =
      value.offersStylistLocation !== undefined ||
      value.offersComeToClient !== undefined ||
      value.offersRemote !== undefined;
    if (offersTouched) {
      const stylist = value.offersStylistLocation === true;
      const home = value.offersComeToClient === true;
      const remote = value.offersRemote === true;
      // Only validate full trio when all three are present in the payload
      if (
        value.offersStylistLocation !== undefined &&
        value.offersComeToClient !== undefined &&
        value.offersRemote !== undefined &&
        !stylist &&
        !home &&
        !remote
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select at least one venue option',
          path: ['offersStylistLocation'],
        });
      }
    }
    if (value.offersStylistLocation === true && value.workplaceAddress === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'workplaceAddress is required when offering stylist location',
        path: ['workplaceAddress'],
      });
    }
  });

export type UpdateBusinessProfileRequest = z.infer<typeof updateBusinessProfileRequestSchema>;

export const DEPOSIT_TYPES = ['flat', 'percentage'] as const;
export const NO_SHOW_FEE_TYPES = ['forfeit_deposit', 'flat_fee', 'no_fee'] as const;

export const businessPolicySchema = z.object({
  businessId: z.string().uuid(),
  depositType: z.enum(DEPOSIT_TYPES),
  depositValue: z.number().positive(),
  cancellationWindowHours: z.number().int().nonnegative(),
  noShowFeeType: z.enum(NO_SHOW_FEE_TYPES),
  noShowFeeValue: z.number().nonnegative().nullable(),
});

export type BusinessPolicy = z.infer<typeof businessPolicySchema>;

export const DEFAULT_BUSINESS_POLICY = {
  depositType: 'percentage' as const,
  depositValue: 20,
  cancellationWindowHours: 24,
  noShowFeeType: 'forfeit_deposit' as const,
  noShowFeeValue: null,
};

export const updateBusinessPolicyRequestSchema = z
  .object({
    depositType: z.enum(DEPOSIT_TYPES),
    depositValue: z.number().positive(),
    cancellationWindowHours: z.number().int().nonnegative(),
    noShowFeeType: z.enum(NO_SHOW_FEE_TYPES),
    noShowFeeValue: z.number().nonnegative().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.depositType === 'percentage' &&
      (value.depositValue < 1 || value.depositValue > 100)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Percentage deposit must be between 1 and 100',
        path: ['depositValue'],
      });
    }
    if (value.noShowFeeType === 'flat_fee' && value.noShowFeeValue == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'noShowFeeValue is required when noShowFeeType is flat_fee',
        path: ['noShowFeeValue'],
      });
    }
  });

export type UpdateBusinessPolicyRequest = z.infer<typeof updateBusinessPolicyRequestSchema>;

export const workingHourRowSchema = z.object({
  id: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  isActive: z.boolean().default(true),
});

export type WorkingHourRow = z.infer<typeof workingHourRowSchema>;

export const replaceWorkingHoursRequestSchema = z.object({
  hours: z.array(workingHourRowSchema).min(1),
});

export const scheduleExceptionSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  date: z.string().date(),
  isClosed: z.boolean(),
  overrideStartTime: timeStringSchema.nullable(),
  overrideEndTime: timeStringSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;

export const createScheduleExceptionRequestSchema = z
  .object({
    date: z.string().date(),
    isClosed: z.boolean().default(false),
    overrideStartTime: timeStringSchema.nullable().optional(),
    overrideEndTime: timeStringSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isClosed && (!value.overrideStartTime || !value.overrideEndTime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'overrideStartTime and overrideEndTime are required when not closed',
        path: ['overrideStartTime'],
      });
    }
  });

export const updateScheduleExceptionRequestSchema = z
  .object({
    isClosed: z.boolean().optional(),
    overrideStartTime: timeStringSchema.nullable().optional(),
    overrideEndTime: timeStringSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

/** Max images a stylist can attach to a single service offering. */
export const PORTFOLIO_IMAGES_PER_SERVICE = 10;

/** Max bytes per portfolio / profile photo upload. */
export const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024;

const portfolioImageContentTypeSchema = z.preprocess(
  (value) => (value === 'image/jpg' ? 'image/jpeg' : value),
  z.enum(['image/jpeg', 'image/png', 'image/webp']),
);

export const portfolioUploadUrlRequestSchema = z.object({
  contentType: portfolioImageContentTypeSchema,
  /** Required for new manual uploads — images are scoped to a service. */
  serviceOfferingId: z.string().uuid(),
  filename: z.string().trim().min(1).max(200).optional(),
});

/** Profile headshot upload — not tied to a service offering. */
export const profilePhotoUploadUrlRequestSchema = z.object({
  contentType: portfolioImageContentTypeSchema,
  filename: z.string().trim().min(1).max(200).optional(),
});

export type ProfilePhotoUploadUrlRequest = z.infer<typeof profilePhotoUploadUrlRequestSchema>;

export const portfolioUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  imageUrl: z.string().url(),
  storageKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export const registerPortfolioItemRequestSchema = z.object({
  imageUrl: z.string().url(),
  storageKey: z.string().min(1),
  serviceOfferingId: z.string().uuid(),
});

export type RegisterPortfolioItemRequest = z.infer<typeof registerPortfolioItemRequestSchema>;

export const registerProfilePhotoRequestSchema = z.object({
  imageUrl: z.string().url(),
  storageKey: z.string().min(1),
});

export type RegisterProfilePhotoRequest = z.infer<typeof registerProfilePhotoRequestSchema>;

export const reorderPortfolioRequestSchema = z.object({
  /** Reorder within a single service's gallery. */
  serviceOfferingId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const createBusinessServiceRequestSchema = z
  .object({
    styleCategoryId: z.string().uuid().optional(),
    customStyleName: z.string().trim().min(1).max(120).optional(),
    sizeTier: z.string().trim().min(1).max(60).nullable().optional(),
    lengthTier: z.string().trim().min(1).max(60).nullable().optional(),
    basePrice: z.number().positive().max(100_000),
    estimatedDurationMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60),
    hairIncluded: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.styleCategoryId && !value.customStyleName) {
      ctx.addIssue({
        code: 'custom',
        message: 'styleCategoryId or customStyleName is required',
        path: ['styleCategoryId'],
      });
    }
    if (value.styleCategoryId && value.customStyleName) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide styleCategoryId or customStyleName, not both',
        path: ['customStyleName'],
      });
    }
  });

const businessServiceFieldsSchema = z.object({
  styleCategoryId: z.string().uuid().optional(),
  customStyleName: z.string().trim().min(1).max(120).optional(),
  sizeTier: z.string().trim().min(1).max(60).nullable().optional(),
  lengthTier: z.string().trim().min(1).max(60).nullable().optional(),
  basePrice: z.number().positive().max(100_000).optional(),
  estimatedDurationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional(),
  hairIncluded: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const updateBusinessServiceRequestSchema = businessServiceFieldsSchema.refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

export const instagramConnectRequestSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().url(),
});

export const instagramImportRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const completeOnboardingRequestSchema = z.object({}).optional();

export type CreateBusinessServiceRequest = z.infer<typeof createBusinessServiceRequestSchema>;
export type UpdateBusinessServiceRequest = z.infer<typeof updateBusinessServiceRequestSchema>;
export type ReorderPortfolioRequest = z.infer<typeof reorderPortfolioRequestSchema>;
