import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiClientError, apiFetch } from './api-client';

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws ApiClientError with UNAUTHORIZED code on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        }),
      }),
    );

    const error = await apiFetch('/profile/me', { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(401);
    expect((error as ApiClientError).code).toBe('UNAUTHORIZED');
  });
});
