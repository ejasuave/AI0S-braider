import type { ApiErrorEnvelope, ApiSuccessEnvelope } from '@project-braids/shared-types/api';
import type { DbHealthResponse, HealthResponse, PingResponse } from '@project-braids/shared-types';
import { getWebEnv } from '@/env';
import { clearAccessToken, getAccessToken, setAccessToken } from './auth-storage';

const API_V1_PREFIX = '/api/v1';
/** Prevent indefinite hangs when the API is restarting or unreachable. */
const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object' && 'error' in body) {
      const envelope = body as ApiErrorEnvelope;
      this.code = envelope.error.code;
    } else if (body && typeof body === 'object' && 'code' in body) {
      this.code = String((body as { code: string }).code) as ApiErrorEnvelope['error']['code'];
    }
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiClientError) {
    const body = error.body;
    if (body && typeof body === 'object') {
      if (
        'error' in body &&
        body.error &&
        typeof body.error === 'object' &&
        'message' in body.error
      ) {
        return String((body.error as { message: string }).message);
      }
      if ('message' in body && typeof body.message === 'string') {
        return body.message;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function parseErrorResponse(body: unknown, status: number): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    if (
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'message' in body.error
    ) {
      const envelope = body.error as { message: string; code?: string };
      return { message: envelope.message, code: envelope.code };
    }
    if ('message' in body && typeof body.message === 'string') {
      return {
        message: body.message,
        code: 'code' in body ? String(body.code) : undefined,
      };
    }
  }
  return { message: `API request failed: ${status}` };
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  json?: unknown;
};

export async function refreshAccessToken(): Promise<string | null> {
  const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}${API_V1_PREFIX}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    headers: {
      'X-Client-Type': 'web',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    clearAccessToken();
    return null;
  }

  const json = (await response.json()) as ApiSuccessEnvelope<{
    tokens: { accessToken: string };
  }>;
  setAccessToken(json.data.tokens.accessToken);
  return json.data.tokens.accessToken;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const normalizedPath = path.startsWith('/api/') ? path : `${API_V1_PREFIX}${path}`;
  const { auth = true, json, ...init } = options;
  const hasJsonBody = json !== undefined;
  const signal = init.signal ?? AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS);

  const buildHeaders = (token: string | null): HeadersInit => ({
    'X-Client-Type': 'web',
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  });

  let token = auth ? getAccessToken() : null;

  let response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    signal,
    credentials: 'include',
    headers: buildHeaders(token),
    body: hasJsonBody ? JSON.stringify(json) : init.body,
  });

  if (response.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) {
      response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...init,
        signal,
        credentials: 'include',
        headers: buildHeaders(token),
        body: hasJsonBody ? JSON.stringify(json) : init.body,
      });
    }
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const { message } = parseErrorResponse(body, response.status);
    throw new ApiClientError(message, response.status, body);
  }

  return (await response.json()) as T;
}

export async function apiFetchData<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const envelope = await apiFetch<ApiSuccessEnvelope<T>>(path, options);
  return envelope.data;
}

export async function fetchPing(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PingResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}/api/v1/ping${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new ApiClientError(`Ping failed: ${response.status}`, response.status);
  }
  const json = (await response.json()) as ApiSuccessEnvelope<PingResponse>;
  return json.data;
}

export async function fetchHealth(
  path: '/health' | '/health/db',
): Promise<HealthResponse | DbHealthResponse> {
  const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new ApiClientError(`Health check failed: ${response.status}`, response.status);
  }
  return (await response.json()) as HealthResponse | DbHealthResponse;
}
