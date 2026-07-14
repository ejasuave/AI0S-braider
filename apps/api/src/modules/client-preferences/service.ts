import { getEnv } from '../../config/env.js';
import type { UpdateNotificationPreferencesRequest } from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { clientPreferencesRepository } from './repository.js';
import { startConfirmationMessage, stopConfirmationMessage } from '../notifications/opt-out.js';

export class ClientPreferencesService {
  async getNotificationPreferences(userId: string) {
    return clientPreferencesRepository.getOrCreatePreferences(userId);
  }

  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesRequest,
    channel: 'web' = 'web',
  ) {
    const previous = await clientPreferencesRepository.getOrCreatePreferences(userId);
    const updated = await clientPreferencesRepository.updatePreferences(userId, input);

    if (
      input.appointmentRemindersEnabled !== undefined &&
      input.appointmentRemindersEnabled !== previous.appointmentRemindersEnabled
    ) {
      const phone = await this.getPhoneForUser(userId);
      if (phone) {
        await clientPreferencesRepository.appendOptOutAuditLog({
          phoneNumber: phone,
          userId,
          action: input.appointmentRemindersEnabled ? 'opt_in' : 'opt_out',
          channel,
          keyword: 'appointment_reminders_enabled',
        });
      }
    }

    return updated;
  }

  private async getPhoneForUser(userId: string): Promise<string | null> {
    const { prisma } = await import('../../lib/db.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });
    return user?.phoneNumber ?? null;
  }

  /**
   * Ch.5.4 integration point — called by Chapter 11 STOP webhook.
   * Blueprint override: halts AI + marketing; appointment reminders remain enabled.
   */
  async handleStopKeyword(phoneNumber: string): Promise<string> {
    const env = getEnv();
    await clientPreferencesRepository.setSmsOptOut(phoneNumber, true);
    const userId = await clientPreferencesRepository.setMarketingOptOutForPhone(phoneNumber, true);
    await clientPreferencesRepository.appendOptOutAuditLog({
      phoneNumber,
      userId,
      action: 'opt_out',
      channel: 'sms',
      keyword: 'STOP',
    });
    return stopConfirmationMessage(env.PLATFORM_DISPLAY_NAME);
  }

  /** Re-enables AI assistant and marketing messages; reminders unchanged unless profile updated. */
  async handleStartKeyword(phoneNumber: string): Promise<string> {
    const env = getEnv();
    await clientPreferencesRepository.setSmsOptOut(phoneNumber, false);
    const userId = await clientPreferencesRepository.setMarketingOptOutForPhone(phoneNumber, false);
    await clientPreferencesRepository.appendOptOutAuditLog({
      phoneNumber,
      userId,
      action: 'opt_in',
      channel: 'sms',
      keyword: 'START',
    });
    return startConfirmationMessage(env.PLATFORM_DISPLAY_NAME);
  }

  async isAiOptedOut(phoneNumber: string): Promise<boolean> {
    const pref = await clientPreferencesRepository.getSmsPreference(phoneNumber);
    return pref?.aiOptedOut ?? false;
  }

  async getProfile(userId: string) {
    const profile = await clientPreferencesRepository.getClientProfile(userId);
    if (!profile) {
      throw new ApiError('NOT_FOUND', 'Client not found', 404);
    }
    return profile;
  }

  async updateProfile(userId: string, input: { displayName?: string; email?: string }) {
    const profile = await clientPreferencesRepository.updateClientProfile(userId, input);
    if (!profile) {
      throw new ApiError('NOT_FOUND', 'Client not found', 404);
    }
    return profile;
  }

  async listSavedStylists(clientId: string) {
    return clientPreferencesRepository.listSavedStylists(clientId);
  }

  async saveStylist(clientId: string, stylistId: string) {
    return clientPreferencesRepository.saveStylist(clientId, stylistId);
  }

  async removeSavedStylist(clientId: string, stylistId: string) {
    await clientPreferencesRepository.removeSavedStylist(clientId, stylistId);
  }
}

export const clientPreferencesService = new ClientPreferencesService();
