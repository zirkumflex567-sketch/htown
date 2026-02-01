import { buildServer } from './server';
import { env } from './env';
import { initDb } from './db';
import { ensureDefaultAdmin } from './services/auth';
import { ensureConfigVersion } from './services/config';
import { initGameAdapter } from './services/gameService';
import { logger } from './logging/logger';

async function start() {
  await initDb();
  await ensureDefaultAdmin();
  await ensureConfigVersion();
  await initGameAdapter();

  const app = await buildServer();

  try {
    await app.listen({ port: env.port, host: env.host });
    logger.log('info', 'admin-api.started', { port: env.port, host: env.host });
  } catch (error) {
    logger.log('error', 'admin-api.start_failed', { message: (error as Error).message });
    process.exit(1);
  }
}

start();
