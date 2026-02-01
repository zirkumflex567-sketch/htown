import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from './helpers';

let app: any;
let cleanup: (() => Promise<void>) | null = null;

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  if (cleanup) await cleanup();
});

describe('auth flow', () => {
  it('logs in default admin and returns tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'admin123' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'wrongpw' }
    });
    expect(response.statusCode).toBe(401);
  });
});
