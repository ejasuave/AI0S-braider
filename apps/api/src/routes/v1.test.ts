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

    await app.close();
  });

  it('returns standard error envelope for unknown v1 routes', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/unknown' });
    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
