import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger().child({ module: 'google-calendar' });

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type GoogleWatchChannel = {
  channelId: string;
  resourceId: string;
  expiration: Date;
};

export interface GoogleCalendarApiClient {
  exchangeCode(input: { code: string; redirectUri: string }): Promise<GoogleTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse>;
  createEvent(input: {
    accessToken: string;
    calendarId: string;
    summary: string;
    start: string;
    end: string;
  }): Promise<GoogleCalendarEvent>;
  deleteEvent(input: { accessToken: string; calendarId: string; eventId: string }): Promise<void>;
  listEvents(input: {
    accessToken: string;
    calendarId: string;
    from: Date;
    to: Date;
  }): Promise<GoogleCalendarEvent[]>;
  watchCalendar(input: {
    accessToken: string;
    calendarId: string;
    webhookUrl: string;
    channelId: string;
    channelToken: string;
  }): Promise<GoogleWatchChannel>;
  stopChannel(input: { accessToken: string; channelId: string; resourceId: string }): Promise<void>;
}

function encodeCalendarPath(calendarId: string): string {
  return encodeURIComponent(calendarId);
}

async function readGoogleOAuthError(
  response: Response,
): Promise<{ code: string; message: string }> {
  try {
    const body = (await response.json()) as {
      error?: string | { message?: string };
      error_description?: string;
    };
    if (typeof body.error === 'string') {
      return {
        code: body.error,
        message: body.error_description ?? body.error,
      };
    }
    if (body.error && typeof body.error === 'object' && body.error.message) {
      return { code: 'oauth_error', message: body.error.message };
    }
  } catch {
    // ignore parse failures
  }
  return { code: 'oauth_error', message: `Google OAuth error (${response.status})` };
}

async function readGoogleError(response: Response): Promise<string> {
  const { message } = await readGoogleOAuthError(response);
  return message;
}

/** Normalize Google event start/end (dateTime or all-day date) to ISO. */
export function googleEventBoundaryToIso(
  boundary: { dateTime?: string; date?: string } | undefined,
  endOfDay: boolean,
): string {
  if (boundary?.dateTime) {
    return new Date(boundary.dateTime).toISOString();
  }
  if (boundary?.date) {
    const suffix = endOfDay ? 'T23:59:59.000Z' : 'T00:00:00.000Z';
    return new Date(`${boundary.date}${suffix}`).toISOString();
  }
  return new Date(0).toISOString();
}

export class MockGoogleCalendarApiClient implements GoogleCalendarApiClient {
  readonly events = new Map<string, GoogleCalendarEvent>();

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<GoogleTokenResponse> {
    return {
      accessToken: `mock-access-${input.code}`,
      refreshToken: `mock-refresh-${input.code}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return {
      accessToken: `${refreshToken}-access`,
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async createEvent(input: {
    accessToken: string;
    calendarId: string;
    summary: string;
    start: string;
    end: string;
  }): Promise<GoogleCalendarEvent> {
    const id = `evt-${this.events.size + 1}`;
    const event = { id, summary: input.summary, start: input.start, end: input.end };
    this.events.set(id, event);
    return event;
  }

  async deleteEvent(input: {
    accessToken: string;
    calendarId: string;
    eventId: string;
  }): Promise<void> {
    this.events.delete(input.eventId);
  }

  async listEvents(input: {
    accessToken: string;
    calendarId: string;
    from: Date;
    to: Date;
  }): Promise<GoogleCalendarEvent[]> {
    return [...this.events.values()].filter((event) => {
      const start = new Date(event.start);
      return start >= input.from && start <= input.to;
    });
  }

  async watchCalendar(input: {
    accessToken: string;
    calendarId: string;
    webhookUrl: string;
    channelId: string;
    channelToken: string;
  }): Promise<GoogleWatchChannel> {
    return {
      channelId: input.channelId,
      resourceId: `resource-${input.channelId}`,
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async stopChannel(): Promise<void> {
    return;
  }
}

/** Live Google Calendar API v3 + OAuth token endpoints. */
export class RealGoogleCalendarApiClient implements GoogleCalendarApiClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeZone: string;

  constructor(input: { clientId: string; clientSecret: string; timeZone: string }) {
    this.clientId = input.clientId;
    this.clientSecret = input.clientSecret;
    this.timeZone = input.timeZone;
  }

  private async tokenRequest(body: Record<string, string>): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const oauthError = await readGoogleOAuthError(response);
      if (oauthError.code === 'invalid_grant') {
        throw ApiError.validation(
          'Authorization code expired or already used. If calendar shows Connected, refresh the page.',
          { googleError: oauthError.code },
        );
      }
      throw ApiError.validation(`Google OAuth failed: ${oauthError.message}`, {
        googleError: oauthError.code,
      });
    }

    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new Error('Google OAuth response missing access_token');
    }

    const refreshToken = json.refresh_token ?? body.refresh_token;
    if (!refreshToken) {
      throw new Error('Google OAuth response missing refresh_token — reconnect with consent');
    }

    return {
      accessToken: json.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    };
  }

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      code: input.code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });
  }

  async createEvent(input: {
    accessToken: string;
    calendarId: string;
    summary: string;
    start: string;
    end: string;
  }): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeCalendarPath(input.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary,
          start: { dateTime: input.start, timeZone: this.timeZone },
          end: { dateTime: input.end, timeZone: this.timeZone },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }

    const json = (await response.json()) as {
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    };

    if (!json.id) {
      throw new Error('Google Calendar createEvent response missing id');
    }

    return {
      id: json.id,
      summary: json.summary ?? input.summary,
      start: googleEventBoundaryToIso(json.start, false),
      end: googleEventBoundaryToIso(json.end, true),
    };
  }

  async deleteEvent(input: {
    accessToken: string;
    calendarId: string;
    eventId: string;
  }): Promise<void> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeCalendarPath(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
    );

    // 404/410 — already deleted
    if (response.status === 404 || response.status === 410) {
      return;
    }

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }
  }

  async listEvents(input: {
    accessToken: string;
    calendarId: string;
    from: Date;
    to: Date;
  }): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: input.from.toISOString(),
      timeMax: input.to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeCalendarPath(input.calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }

    const json = (await response.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };

    return (json.items ?? [])
      .filter((item): item is typeof item & { id: string } => Boolean(item.id))
      .map((item) => ({
        id: item.id,
        summary: item.summary ?? '(no title)',
        start: googleEventBoundaryToIso(item.start, false),
        end: googleEventBoundaryToIso(item.end, true),
      }));
  }

  async watchCalendar(input: {
    accessToken: string;
    calendarId: string;
    webhookUrl: string;
    channelId: string;
    channelToken: string;
  }): Promise<GoogleWatchChannel> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeCalendarPath(input.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: input.channelId,
          type: 'web_hook',
          address: input.webhookUrl,
          token: input.channelToken,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }

    const json = (await response.json()) as {
      id?: string;
      resourceId?: string;
      expiration?: string;
    };

    if (!json.id || !json.resourceId) {
      throw new Error('Google Calendar watch response missing channel id/resourceId');
    }

    return {
      channelId: json.id,
      resourceId: json.resourceId,
      expiration: json.expiration
        ? new Date(Number(json.expiration))
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async stopChannel(input: {
    accessToken: string;
    channelId: string;
    resourceId: string;
  }): Promise<void> {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/channels/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: input.channelId,
        resourceId: input.resourceId,
      }),
    });

    if (response.status === 404 || response.status === 410) {
      return;
    }

    if (!response.ok) {
      throw new Error(await readGoogleError(response));
    }
  }
}

let googleCalendarClient: GoogleCalendarApiClient | undefined;

export function isGoogleCalendarMockMode(): boolean {
  const env = getEnv();
  return !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET;
}

export function createGoogleCalendarApiClient(): GoogleCalendarApiClient {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    log.info('Google Calendar using mock client (GOOGLE_CLIENT_ID/SECRET unset)');
    return new MockGoogleCalendarApiClient();
  }

  log.info('Google Calendar using live Google Calendar API client');
  return new RealGoogleCalendarApiClient({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    timeZone: env.PLATFORM_TIMEZONE,
  });
}

export function getGoogleCalendarApiClient(): GoogleCalendarApiClient {
  googleCalendarClient ??= createGoogleCalendarApiClient();
  return googleCalendarClient;
}

export function setGoogleCalendarApiClient(client: GoogleCalendarApiClient): void {
  googleCalendarClient = client;
}

export function resetGoogleCalendarApiClient(): void {
  googleCalendarClient = undefined;
}
