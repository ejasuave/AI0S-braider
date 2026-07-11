import { DEFAULT_BUSINESS_POLICY } from '@project-braids/shared-types/api';
import type { BusinessPolicy } from '@project-braids/shared-types/api';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { toBusinessPolicy } from './mappers.js';

/** Ch.6.5 — cross-module policy contract for Booking (Ch.7) and Payments (Ch.9). */
export async function getBusinessPolicy(businessId: string): Promise<BusinessPolicy> {
  const policy = await prisma.businessPolicy.findUnique({ where: { businessId } });
  if (!policy) {
    throw ApiError.notFound('Business policy not found');
  }
  return toBusinessPolicy(policy);
}

export async function getBusinessPolicyByStylistId(stylistId: string): Promise<BusinessPolicy> {
  const profile = await prisma.stylistProfile.findUnique({
    where: { id: stylistId },
    select: { businessId: true },
  });
  if (!profile?.businessId) {
    throw ApiError.notFound('Business not linked to stylist profile');
  }
  return getBusinessPolicy(profile.businessId);
}

export async function ensureDefaultBusinessPolicy(businessId: string): Promise<BusinessPolicy> {
  const existing = await prisma.businessPolicy.findUnique({ where: { businessId } });
  if (existing) {
    return toBusinessPolicy(existing);
  }

  const created = await prisma.businessPolicy.create({
    data: {
      businessId,
      depositType: DEFAULT_BUSINESS_POLICY.depositType,
      depositValue: DEFAULT_BUSINESS_POLICY.depositValue,
      cancellationWindowHours: DEFAULT_BUSINESS_POLICY.cancellationWindowHours,
      noShowFeeType: DEFAULT_BUSINESS_POLICY.noShowFeeType,
      noShowFeeValue: DEFAULT_BUSINESS_POLICY.noShowFeeValue,
    },
  });

  return toBusinessPolicy(created);
}

/** Legacy deposit shape for modules still on stylist_id scoping. */
export function policyToLegacyDeposit(policy: BusinessPolicy): {
  type: 'flat' | 'percent';
  value: number;
} {
  return {
    type: policy.depositType === 'flat' ? 'flat' : 'percent',
    value: policy.depositValue,
  };
}
