import { prisma } from '../../lib/db.js';
import type { NotificationPreferences } from '@project-braids/shared-types/api';

export type OptOutAuditInput = {
  phoneNumber: string;
  userId?: string | null;
  action: 'opt_out' | 'opt_in';
  channel: 'sms' | 'whatsapp' | 'web';
  keyword?: string | null;
};

export class ClientPreferencesRepository {
  async findUserIdByPhone(phoneNumber: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  async getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
    const row = await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      appointmentRemindersEnabled: row.appointmentRemindersEnabled,
      marketingMessagesEnabled: row.marketingMessagesEnabled,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updatePreferences(
    userId: string,
    input: Partial<{
      appointmentRemindersEnabled: boolean;
      marketingMessagesEnabled: boolean;
    }>,
  ): Promise<NotificationPreferences> {
    const row = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        appointmentRemindersEnabled: input.appointmentRemindersEnabled ?? true,
        marketingMessagesEnabled: input.marketingMessagesEnabled ?? true,
      },
      update: input,
    });
    return {
      appointmentRemindersEnabled: row.appointmentRemindersEnabled,
      marketingMessagesEnabled: row.marketingMessagesEnabled,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPreferencesForRecipient(recipientId: string): Promise<NotificationPreferences | null> {
    const row = await prisma.notificationPreference.findUnique({
      where: { userId: recipientId },
    });
    if (!row) {
      return null;
    }
    return {
      appointmentRemindersEnabled: row.appointmentRemindersEnabled,
      marketingMessagesEnabled: row.marketingMessagesEnabled,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async setSmsOptOut(phoneNumber: string, optedOut: boolean): Promise<void> {
    const now = new Date();
    await prisma.smsPreference.upsert({
      where: { phoneNumber },
      create: {
        phoneNumber,
        aiOptedOut: optedOut,
        marketingOptedOut: optedOut,
        optedOutAt: optedOut ? now : null,
        optedInAt: optedOut ? null : now,
      },
      update: {
        aiOptedOut: optedOut,
        marketingOptedOut: optedOut,
        optedOutAt: optedOut ? now : undefined,
        optedInAt: optedOut ? null : now,
      },
    });
  }

  async setMarketingOptOutForPhone(phoneNumber: string, optedOut: boolean): Promise<string | null> {
    const userId = await this.findUserIdByPhone(phoneNumber);
    if (!userId) {
      return null;
    }
    await this.updatePreferences(userId, { marketingMessagesEnabled: !optedOut });
    return userId;
  }

  async appendOptOutAuditLog(input: OptOutAuditInput): Promise<void> {
    await prisma.optOutAuditLog.create({
      data: {
        phoneNumber: input.phoneNumber,
        userId: input.userId ?? null,
        action: input.action,
        channel: input.channel,
        keyword: input.keyword ?? null,
      },
    });
  }

  async getClientProfile(userId: string) {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true, email: true },
      }),
      prisma.clientProfile.findUnique({ where: { userId } }),
    ]);
    if (!user) return null;
    return {
      displayName: profile?.displayName ?? null,
      email: user.email,
      phoneNumber: user.phoneNumber,
      updatedAt: (profile?.updatedAt ?? new Date()).toISOString(),
    };
  }

  async updateClientProfile(userId: string, input: { displayName?: string; email?: string }) {
    if (input.email !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { email: input.email },
      });
    }
    if (input.displayName !== undefined) {
      await prisma.clientProfile.upsert({
        where: { userId },
        create: { userId, displayName: input.displayName },
        update: { displayName: input.displayName },
      });
    }
    return this.getClientProfile(userId);
  }

  async listSavedStylists(clientId: string) {
    const rows = await prisma.savedStylist.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        stylist: {
          select: {
            id: true,
            businessName: true,
            locationArea: true,
            directoryVisible: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      stylistId: row.stylistId,
      businessName: row.stylist.businessName,
      locationArea: row.stylist.locationArea,
      directoryVisible: row.stylist.directoryVisible,
      savedAt: row.createdAt.toISOString(),
    }));
  }

  async saveStylist(clientId: string, stylistId: string) {
    await prisma.savedStylist.upsert({
      where: { clientId_stylistId: { clientId, stylistId } },
      create: { clientId, stylistId },
      update: {},
    });
    return this.listSavedStylists(clientId);
  }

  async removeSavedStylist(clientId: string, stylistId: string) {
    await prisma.savedStylist.deleteMany({
      where: { clientId, stylistId },
    });
  }

  async getSmsPreference(phoneNumber: string) {
    return prisma.smsPreference.findUnique({ where: { phoneNumber } });
  }
}

export const clientPreferencesRepository = new ClientPreferencesRepository();
