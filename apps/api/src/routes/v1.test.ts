import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('v1 routes', () => {
  it('returns pong from GET /api/v1/ping', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/ping' });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data.pong).toBe(true);
    expect(body.data.service).toBe('api');
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.meta).toEqual({ page: 1, pageSize: 20 });

    await app.close();
  });

  it('returns VALIDATION_ERROR for invalid pagination on GET /api/v1/ping', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ping?pageSize=500',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.details).toBeDefined();

    await app.close();
  });

  it('returns standard error envelope for unknown v1 routes', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/unknown' });
    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
