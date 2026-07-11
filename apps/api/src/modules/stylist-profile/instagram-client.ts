export type InstagramMediaItem = {
  id: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
};

export type InstagramTokenResponse = {
  accessToken: string;
  userId: string;
  expiresAt: Date;
};

export class InstagramAccountIneligibleError extends Error {
  constructor(message = 'Instagram account is ineligible for import') {
    super(message);
    this.name = 'InstagramAccountIneligibleError';
  }
}

export interface InstagramApiClient {
  exchangeCode(input: { code: string; redirectUri: string }): Promise<InstagramTokenResponse>;
  refreshToken(accessToken: string): Promise<InstagramTokenResponse>;
  fetchRecentMedia(input: {
    accessToken: string;
    userId: string;
    limit: number;
  }): Promise<InstagramMediaItem[]>;
}

export class MockInstagramApiClient implements InstagramApiClient {
  async exchangeCode(input: { code: string; redirectUri: string }): Promise<InstagramTokenResponse> {
    if (input.code === 'ineligible') {
      throw new InstagramAccountIneligibleError();
    }
    return {
      accessToken: `mock-token-${input.code}`,
      userId: 'mock-instagram-user',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }

  async refreshToken(accessToken: string): Promise<InstagramTokenResponse> {
    return {
      accessToken: `${accessToken}-refreshed`,
      userId: 'mock-instagram-user',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }

  async fetchRecentMedia(input: {
    accessToken: string;
    userId: string;
    limit: number;
  }): Promise<InstagramMediaItem[]> {
    if (input.accessToken.includes('ineligible')) {
      throw new InstagramAccountIneligibleError();
    }
    return Array.from({ length: Math.min(input.limit, 3) }, (_, index) => ({
      id: `media-${index + 1}`,
      mediaUrl: `https://cdn.example.com/instagram/${index + 1}.jpg`,
      mediaType: 'IMAGE' as const,
    }));
  }
}

let instagramClient: InstagramApiClient = new MockInstagramApiClient();

export function getInstagramApiClient(): InstagramApiClient {
  return instagramClient;
}

export function setInstagramApiClient(client: InstagramApiClient): void {
  instagramClient = client;
}
