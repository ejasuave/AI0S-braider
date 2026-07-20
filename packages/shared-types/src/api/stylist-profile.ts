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

export {
  REMAINING_BALANCE_METHODS,
  remainingBalanceMethodLabel,
  remainingBalanceAllowsOnlineCard,
  type RemainingBalanceMethod,
} from './service-catalogs.js';

import { REMAINING_BALANCE_METHODS } from './service-catalogs.js';

export const MAX_SERVICE_REQUIREMENTS = 20;
export const MAX_SERVICE_ADDONS = 50;
export const MAX_REQUIREMENT_LENGTH = 200;
export const MAX_POLICY_TEXT_LENGTH = 2000;

const policyTextSchema = z.string().trim().max(MAX_POLICY_TEXT_LENGTH).nullable();

/** Structured requirement (catalog or custom). Legacy string[] is accepted on parse. */
export const serviceRequirementItemSchema = z.object({
  text: z.string().trim().min(1).max(MAX_REQUIREMENT_LENGTH),
  catalogKey: z.string().trim().min(1).max(80).optional(),
});

export type ServiceRequirementItem = z.infer<typeof serviceRequirementItemSchema>;

/** Accept legacy plain strings or structured items; always output structured. */
export const serviceRequirementSchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_REQUIREMENT_LENGTH)
    .transform((text) => ({ text })),
  serviceRequirementItemSchema,
]);

export const serviceAddonSchema = z.object({
  id: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string(),
  active: z.boolean(),
  displayOrder: z.number().int(),
  /** Preloaded catalog key when enabled from ADDONS_CATALOG; null for custom. */
  catalogKey: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ServiceAddon = z.infer<typeof serviceAddonSchema>;

export const createServiceAddonRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().nonnegative().max(100_000),
  active: z.boolean().optional(),
  catalogKey: z.string().trim().min(1).max(80).nullable().optional(),
});

export type CreateServiceAddonRequest = z.infer<typeof createServiceAddonRequestSchema>;

export const updateServiceAddonRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    price: z.number().nonnegative().max(100_000).optional(),
    active: z.boolean().optional(),
    catalogKey: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateServiceAddonRequest = z.infer<typeof updateServiceAddonRequestSchema>;

export const reorderServiceAddonsRequestSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(MAX_SERVICE_ADDONS),
});

export type ReorderServiceAddonsRequest = z.infer<typeof reorderServiceAddonsRequestSchema>;

export const businessPolicySchema = z.object({
  businessId: z.string().uuid(),
  depositType: z.enum(DEPOSIT_TYPES),
  depositValue: z.number().positive(),
  cancellationWindowHours: z.number().int().nonnegative(),
  noShowFeeType: z.enum(NO_SHOW_FEE_TYPES),
  noShowFeeValue: z.number().nonnegative().nullable(),
  cancellationPolicyText: z.string().nullable(),
  reschedulingPolicyText: z.string().nullable(),
  lateArrivalPolicyText: z.string().nullable(),
  noShowPolicyText: z.string().nullable(),
  refundPolicyText: z.string().nullable(),
  childrenPolicyText: z.string().nullable(),
  guestPolicyText: z.string().nullable(),
  depositPolicyText: z.string().nullable(),
  remainingBalanceMethod: z.enum(REMAINING_BALANCE_METHODS),
});

export type BusinessPolicy = z.infer<typeof businessPolicySchema>;

export const DEFAULT_BUSINESS_POLICY = {
  depositType: 'percentage' as const,
  depositValue: 20,
  cancellationWindowHours: 24,
  noShowFeeType: 'forfeit_deposit' as const,
  noShowFeeValue: null,
  cancellationPolicyText: null as string | null,
  reschedulingPolicyText: null as string | null,
  lateArrivalPolicyText: null as string | null,
  noShowPolicyText: null as string | null,
  refundPolicyText: null as string | null,
  childrenPolicyText: null as string | null,
  guestPolicyText: null as string | null,
  depositPolicyText: null as string | null,
  remainingBalanceMethod: 'cash_or_card' as const,
};

const depositOverrideRefine = (
  value: {
    depositType?: 'flat' | 'percentage' | null;
    depositValue?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  const hasType = value.depositType !== undefined && value.depositType !== null;
  const hasValue = value.depositValue !== undefined && value.depositValue !== null;
  if (hasType !== hasValue) {
    ctx.addIssue({
      code: 'custom',
      message: 'depositType and depositValue must be set together (or both cleared)',
      path: ['depositValue'],
    });
  }
  if (
    value.depositType === 'percentage' &&
    value.depositValue != null &&
    (value.depositValue < 1 || value.depositValue > 100)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Percentage deposit must be between 1 and 100',
      path: ['depositValue'],
    });
  }
};

export const updateBusinessPolicyRequestSchema = z
  .object({
    depositType: z.enum(DEPOSIT_TYPES),
    depositValue: z.number().positive(),
    cancellationWindowHours: z.number().int().nonnegative(),
    noShowFeeType: z.enum(NO_SHOW_FEE_TYPES),
    noShowFeeValue: z.number().nonnegative().nullable().optional(),
    cancellationPolicyText: policyTextSchema.optional(),
    reschedulingPolicyText: policyTextSchema.optional(),
    lateArrivalPolicyText: policyTextSchema.optional(),
    noShowPolicyText: policyTextSchema.optional(),
    refundPolicyText: policyTextSchema.optional(),
    childrenPolicyText: policyTextSchema.optional(),
    guestPolicyText: policyTextSchema.optional(),
    depositPolicyText: policyTextSchema.optional(),
    remainingBalanceMethod: z.enum(REMAINING_BALANCE_METHODS).optional(),
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

export const publicBusinessPolicySchema = z.object({
  cancellationWindowHours: z.number().int().nonnegative(),
  depositType: z.enum(DEPOSIT_TYPES),
  depositValue: z.number().positive(),
  noShowFeeType: z.enum(NO_SHOW_FEE_TYPES),
  noShowFeeValue: z.number().nonnegative().nullable(),
  cancellationPolicyText: z.string().nullable(),
  reschedulingPolicyText: z.string().nullable(),
  lateArrivalPolicyText: z.string().nullable(),
  noShowPolicyText: z.string().nullable(),
  refundPolicyText: z.string().nullable(),
  childrenPolicyText: z.string().nullable(),
  guestPolicyText: z.string().nullable(),
  depositPolicyText: z.string().nullable(),
  remainingBalanceMethod: z.enum(REMAINING_BALANCE_METHODS),
});

export type PublicBusinessPolicy = z.infer<typeof publicBusinessPolicySchema>;

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
  /**
   * Scope upload to a service gallery. Omit / null for general “Other work” photos.
   */
  serviceOfferingId: z.string().uuid().nullable().optional(),
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
  /** Omit / null for general “Other work” photos. */
  serviceOfferingId: z.string().uuid().nullable().optional(),
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
    description: z.string().trim().max(2000).nullable().optional(),
    requirements: z.array(serviceRequirementSchema).max(MAX_SERVICE_REQUIREMENTS).optional(),
    depositType: z.enum(DEPOSIT_TYPES).nullable().optional(),
    depositValue: z.number().positive().max(100_000).nullable().optional(),
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
    depositOverrideRefine(value, ctx);
  });

/** Empty / whitespace-only strings from HTML forms → null for nullable tier fields. */
const optionalNullableTierSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}, z.string().trim().min(1).max(60).nullable().optional());

const optionalNullableDescriptionSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}, z.string().trim().max(2000).nullable().optional());

const businessServiceFieldsSchema = z.object({
  styleCategoryId: z.string().uuid().nullable().optional(),
  customStyleName: z.string().trim().min(1).max(120).optional(),
  styleName: z.string().trim().min(1).max(120).optional(),
  sizeTier: optionalNullableTierSchema,
  lengthTier: optionalNullableTierSchema,
  basePrice: z.number().positive().max(100_000).optional(),
  estimatedDurationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional(),
  hairIncluded: z.boolean().optional(),
  active: z.boolean().optional(),
  description: optionalNullableDescriptionSchema,
  requirements: z.array(serviceRequirementSchema).max(MAX_SERVICE_REQUIREMENTS).optional(),
  depositType: z.enum(DEPOSIT_TYPES).nullable().optional(),
  depositValue: z.number().positive().max(100_000).nullable().optional(),
});

export const updateBusinessServiceRequestSchema = businessServiceFieldsSchema
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .superRefine((value, ctx) => depositOverrideRefine(value, ctx));

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
