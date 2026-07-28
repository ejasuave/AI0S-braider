/**
 * Staging ops: wipe a stylist owner's business data while keeping the same login.
 *
 * Usage (from repo root, with .env.staging loaded externally):
 *   DATABASE_URL=... pnpm exec tsx apps/api/scripts/wipe-stylist-tenant.ts --email=you@example.com
 */
import { PrismaClient } from '@prisma/client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const email = (arg('email') ?? '').trim().toLowerCase();
if (!email) {
  console.error('Required: --email=...');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      stylistProfile: true,
      ownedBusiness: true,
    },
  });
  if (!user) {
    throw new Error(`No user with email ${email}`);
  }
  if (user.role !== 'stylist_owner') {
    throw new Error(`User role is ${user.role}, expected stylist_owner`);
  }

  const stylistId = user.stylistProfile?.id ?? null;
  const businessId = user.ownedBusiness?.id ?? user.stylistProfile?.businessId ?? null;

  console.log('Wiping stylist tenant for', email, { stylistId, businessId });

  await prisma.$transaction(async (tx) => {
    if (stylistId) {
      const bookingIds = (
        await tx.booking.findMany({ where: { stylistId }, select: { id: true } })
      ).map((b) => b.id);

      if (bookingIds.length > 0) {
        await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.notification.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.disputeEvidencePackage.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.calendarConflict.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.externalCalendarLink.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }

      const conversationIds = (
        await tx.conversation.findMany({ where: { stylistId }, select: { id: true } })
      ).map((c) => c.id);
      if (conversationIds.length > 0) {
        await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      }

      await tx.savedStylist.deleteMany({ where: { stylistId } });
      await tx.portfolioItem.deleteMany({ where: { stylistId } });

      const offeringIds = (
        await tx.serviceOffering.findMany({ where: { stylistId }, select: { id: true } })
      ).map((o) => o.id);
      if (offeringIds.length > 0) {
        await tx.serviceAddon.deleteMany({ where: { serviceOfferingId: { in: offeringIds } } });
        await tx.serviceOffering.deleteMany({ where: { id: { in: offeringIds } } });
      }
    }

    if (businessId) {
      await tx.externalCalendarLink.deleteMany({ where: { businessId } });
      await tx.calendarConflict.deleteMany({ where: { businessId } });
      await tx.calendarConnection.deleteMany({ where: { businessId } });
      await tx.instagramConnection.deleteMany({ where: { businessId } });
      await tx.paymentAccount.deleteMany({ where: { businessId } });
      await tx.businessStaff.deleteMany({ where: { businessId } });
      await tx.workingHour.deleteMany({ where: { businessId } });
      await tx.scheduleException.deleteMany({ where: { businessId } });
      await tx.businessPolicy.deleteMany({ where: { businessId } });
      await tx.portfolioItem.deleteMany({ where: { businessId } });
      await tx.serviceOffering.deleteMany({ where: { businessId } });

      await tx.business.update({
        where: { id: businessId },
        data: {
          businessName: '',
          bio: null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          serviceAreaRadiusKm: null,
          offersStylistLocation: true,
          offersComeToClient: false,
          offersRemote: false,
          workplaceAddress: null,
          homeVisitSurcharge: null,
          onboardingStatus: 'in_progress',
        },
      });
    }

    if (stylistId) {
      await tx.stylistProfile.update({
        where: { id: stylistId },
        data: {
          businessName: '',
          bio: null,
          locationArea: null,
          serviceAreaRadiusKm: null,
          cancellationPolicy: null,
          depositPolicy: null,
          workingHours: null,
          bufferMinutes: 15,
          requireStylistApproval: false,
          onboardingStatus: 'in_progress',
          directoryVisible: false,
          photoUrl: null,
          photoStorageKey: null,
          smsBookingNumber: null,
          ...(businessId ? { businessId } : {}),
        },
      });
    }

    // Force re-login so any cached permissions/profile are fresh.
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  console.log('Done. Login unchanged; business data cleared; onboarding reset to in_progress.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
