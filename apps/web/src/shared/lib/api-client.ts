import type { ApiSuccessEnvelope, PingResponse } from '@project-braids/shared-types/api';
import { getWebEnv } from '@/env';

const API_V1_PREFIX = '/api/v1';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
  const normalizedPath = path.startsWith('/api/') ? path : `${API_V1_PREFIX}${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiClientError(`API request failed: ${response.status}`, response.status, body);
  }

  const json = (await response.json()) as T;
  return json;
}

export async function apiFetchData<T>(path: string, init?: RequestInit): Promise<T> {
  const envelope = await apiFetch<ApiSuccessEnvelope<T>>(path, init);
  return envelope.data;
}

export async function fetchPing(): Promise<PingResponse> {
  return apiFetchData<PingResponse>('/ping');
}
