export async function createTestServer() {
  process.env.ADMIN_DB_PROVIDER = 'sqlite';
  process.env.ADMIN_SQLITE_PATH = ':memory:';
  process.env.ADMIN_DEFAULT_USER = 'admin';
  process.env.ADMIN_DEFAULT_PASSWORD = 'admin123';
  process.env.ADMIN_GAME_ADAPTER = 'stub';

  const { initDb, closeDb } = await import('../src/db');
  const { ensureDefaultAdmin } = await import('../src/services/auth');
  const { ensureConfigVersion } = await import('../src/services/config');
  const { initGameAdapter } = await import('../src/services/gameService');
  const { buildServer } = await import('../src/server');

  await initDb();
  await ensureDefaultAdmin();
  await ensureConfigVersion();
  await initGameAdapter();
  const app = await buildServer();

  return {
    app,
    async cleanup() {
      await app.close();
      await closeDb();
    }
  };
}
