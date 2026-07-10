import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('health routes', () => {
  it('returns ok from /health', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    await app.close();
  });
});
