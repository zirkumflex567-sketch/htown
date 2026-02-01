import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from './helpers';
import { defaultAdminConfig } from '@htown/admin-shared';

let app: any;
let cleanup: (() => Promise<void>) | null = null;

async function login(username: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password }
  });
  return response.json();
}

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  if (cleanup) await cleanup();
});

describe('rbac and config versioning', () => {
  it('blocks config publish for MOD role', async () => {
    const admin = await login('admin', 'admin123');
    const create = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { username: 'mod', password: 'modpassword', role: 'MOD' }
    });
    expect(create.statusCode).toBe(200);

    const modLogin = await login('mod', 'modpassword');
    const publish = await app.inject({
      method: 'POST',
      url: '/config/publish',
      headers: { authorization: `Bearer ${modLogin.accessToken}` },
      payload: { message: 'test', data: defaultAdminConfig() }
    });
    expect(publish.statusCode).toBe(403);
  });

  it('publishes and rolls back config', async () => {
    const admin = await login('admin', 'admin123');
    const current = await app.inject({
      method: 'GET',
      url: '/config/current',
      headers: { authorization: `Bearer ${admin.accessToken}` }
    });
    const currentBody = current.json();

    const nextConfig = { ...defaultAdminConfig(), economy: { ...defaultAdminConfig().economy, xpGainMultiplier: 1.5 } };
    const publish = await app.inject({
      method: 'POST',
      url: '/config/publish',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { message: 'bump xp', data: nextConfig }
    });
    expect(publish.statusCode).toBe(200);

    const rollback = await app.inject({
      method: 'POST',
      url: '/config/rollback',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { versionId: currentBody.id, message: 'rollback' }
    });
    expect(rollback.statusCode).toBe(200);
  });
});
