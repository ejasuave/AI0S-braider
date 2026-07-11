import { getEnv } from '../../config/env.js';
import { prisma } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { encryptAtRest, decryptAtRest } from '../../lib/security/encryption.js';
import {
  getInstagramApiClient,
  InstagramAccountIneligibleError,
} from './instagram-client.js';
import { PORTFOLIO_ITEM_LIMIT } from './mappers.js';

function encryptionSecret(): string {
  return getEnv().JWT_SECRET;
}

export class InstagramService {
  async connect(input: {
    businessId: string;
    code: string;
    redirectUri: string;
  }): Promise<{ connected: true }> {
    try {
      const token = await getInstagramApiClient().exchangeCode({
        code: input.code,
        redirectUri: input.redirectUri,
      });

      await prisma.instagramConnection.upsert({
        where: { businessId: input.businessId },
        create: {
          businessId: input.businessId,
          instagramUserId: token.userId,
          accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
          tokenExpiresAt: token.expiresAt,
        },
        update: {
          instagramUserId: token.userId,
          accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
          tokenExpiresAt: token.expiresAt,
        },
      });

      return { connected: true };
    } catch (error) {
      if (error instanceof InstagramAccountIneligibleError) {
        throw new ApiError(
          'INSTAGRAM_ACCOUNT_INELIGIBLE',
          'This Instagram account cannot be imported. Use manual portfolio upload instead.',
          422,
        );
      }
      throw error;
    }
  }

  async importMedia(input: {
    businessId: string;
    stylistId: string;
    limit?: number;
  }): Promise<{ imported: number }> {
    const connection = await prisma.instagramConnection.findUnique({
      where: { businessId: input.businessId },
    });
    if (!connection) {
      throw ApiError.validation('Instagram is not connected for this business');
    }

    const accessToken = decryptAtRest(connection.accessTokenEnc, encryptionSecret());
    const limit = input.limit ?? 12;

    try {
      const media = await getInstagramApiClient().fetchRecentMedia({
        accessToken,
        userId: connection.instagramUserId,
        limit,
      });

      const existingCount = await prisma.portfolioItem.count({ where: { businessId: input.businessId } });
      let imported = 0;

      for (const item of media) {
        if (item.mediaType !== 'IMAGE') {
          continue;
        }
        if (existingCount + imported >= PORTFOLIO_ITEM_LIMIT) {
          break;
        }

        const maxOrder = await prisma.portfolioItem.aggregate({
          where: { businessId: input.businessId },
          _max: { displayOrder: true },
        });

        await prisma.portfolioItem.create({
          data: {
            businessId: input.businessId,
            stylistId: input.stylistId,
            imageUrl: item.mediaUrl,
            source: 'instagram',
            displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
          },
        });
        imported += 1;
      }

      return { imported };
    } catch (error) {
      if (error instanceof InstagramAccountIneligibleError) {
        throw new ApiError(
          'INSTAGRAM_ACCOUNT_INELIGIBLE',
          'This Instagram account cannot be imported. Use manual portfolio upload instead.',
          422,
        );
      }
      throw error;
    }
  }

  async refreshExpiringTokens(withinHours = 24): Promise<number> {
    const threshold = new Date(Date.now() + withinHours * 60 * 60 * 1000);
    const connections = await prisma.instagramConnection.findMany({
      where: { tokenExpiresAt: { lte: threshold } },
    });

    let refreshed = 0;
    for (const connection of connections) {
      const accessToken = decryptAtRest(connection.accessTokenEnc, encryptionSecret());
      const token = await getInstagramApiClient().refreshToken(accessToken);
      await prisma.instagramConnection.update({
        where: { businessId: connection.businessId },
        data: {
          accessTokenEnc: encryptAtRest(token.accessToken, encryptionSecret()),
          tokenExpiresAt: token.expiresAt,
        },
      });
      refreshed += 1;
    }

    return refreshed;
  }
}

export const instagramService = new InstagramService();
