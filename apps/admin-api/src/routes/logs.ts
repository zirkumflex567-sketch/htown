import { FastifyInstance } from 'fastify';
import { logger, readLogFile, logLevels } from '../logging/logger';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { verifyAccessToken } from '../services/auth';
import { hasPermission } from '../rbac/permissions';

const isValidLevel = (level?: string) => level && logLevels.includes(level as any);

export async function registerLogRoutes(app: FastifyInstance) {
  app.get('/logs/tail', async (request, reply) => {
    const { level, q, token } = request.query as { level?: string; q?: string; token?: string };
    const header = request.headers.authorization;
    const rawToken = token ?? (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '');
    if (!rawToken) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    try {
      const payload = verifyAccessToken(rawToken);
      if (!hasPermission(payload.role, 'logs:read')) {
        return reply.code(403).send({ error: 'FORBIDDEN' });
      }
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    reply.raw.write('\n');

    const listenerId = `log-${Date.now()}-${Math.random()}`;
    const filter = {
      level: isValidLevel(level) ? level : undefined,
      q
    };
    const send = (entry: any) => {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    const backlog = logger.store.list(filter).slice(-50);
    backlog.forEach(send);

    logger.store.subscribe({
      id: listenerId,
      filter,
      send,
      close: () => {
        reply.raw.end();
      }
    });

    request.raw.on('close', () => {
      logger.store.unsubscribe(listenerId);
    });
  });

  app.get('/logs/query', { preHandler: [requireAuth, requirePermission('logs:read')] }, async (request) => {
    const { from, to, level, q, limit } = request.query as {
      from?: string;
      to?: string;
      level?: string;
      q?: string;
      limit?: string;
    };
    const entries = await readLogFile();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() : null;
    const filtered = entries.filter((entry) => {
      if (level && entry.level !== level) return false;
      if (fromTs && new Date(entry.ts).getTime() < fromTs) return false;
      if (toTs && new Date(entry.ts).getTime() > toTs) return false;
      if (q) {
        const haystack = `${entry.message} ${JSON.stringify(entry.context ?? {})}`.toLowerCase();
        if (!haystack.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    const max = limit ? Math.min(Number(limit), 1000) : 200;
    return { data: filtered.slice(-max) };
  });
}
