import { FastifyInstance } from 'fastify';
import { metrics } from '../services/metrics';
import { getDb } from '../db';
import { env } from '../env';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() }));

  app.get('/metrics', async () => {
    const snapshot = metrics.snapshot();
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const db = getDb();
    const connected = await db.isConnected();
    return {
      uptime: process.uptime(),
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed
      },
      cpu: {
        user: cpu.user,
        system: cpu.system
      },
      rps: snapshot.rps,
      errorRate: snapshot.errorRate,
      db: {
        connected,
        provider: env.dbProvider
      }
    };
  });

  app.get('/status', async () => {
    const mem = process.memoryUsage();
    const db = getDb();
    const connected = await db.isConnected();
    return {
      ok: connected,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: mem,
      db: {
        provider: env.dbProvider,
        connected
      }
    };
  });
}
