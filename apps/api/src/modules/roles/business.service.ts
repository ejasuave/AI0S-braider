import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';

export class BusinessService {
  /**
   * One business per stylist_owner. Created during profile onboarding (Ch.6)
   * or lazily on first tenant resolution.
   */
  async ensureBusinessForOwner(ownerUserId: string, businessName = ''): Promise<{ id: string }> {
    const existing = await prisma.business.findUnique({
      where: { ownerUserId },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const business = await prisma.business.create({
      data: { ownerUserId, businessName },
      select: { id: true },
    });

    await prisma.stylistProfile.updateMany({
      where: { userId: ownerUserId, businessId: null },
      data: { businessId: business.id },
    });

    return business;
  }

  async getBusinessById(businessId: string) {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw ApiError.notFound('Business not found');
    }
    return business;
  }

  async resolveBusinessIdForUser(userId: string, role: string): Promise<string | null> {
    if (role === 'stylist_owner') {
      const business = await this.ensureBusinessForOwner(userId);
      return business.id;
    }

    if (role === 'stylist_staff') {
      const staff = await prisma.businessStaff.findFirst({
        where: {
          userId,
          acceptedAt: { not: null },
          removedAt: null,
        },
        select: { businessId: true },
      });
      return staff?.businessId ?? null;
    }

    return null;
  }

  async isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerUserId: true },
    });
    return business?.ownerUserId === userId;
  }

  async getActiveStaffMembership(businessId: string, userId: string) {
    return prisma.businessStaff.findFirst({
      where: {
        businessId,
        userId,
        acceptedAt: { not: null },
        removedAt: null,
      },
    });
  }
}

export const businessService = new BusinessService();
