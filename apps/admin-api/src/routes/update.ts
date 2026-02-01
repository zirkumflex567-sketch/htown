import { FastifyInstance } from 'fastify';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { requireAuth, requirePermission } from '../services/authMiddleware';

const UPDATE_SCRIPT = process.env.ADMIN_UPDATE_SCRIPT ?? '/opt/htown/scripts/update.sh';
const UPDATE_STATUS_FILE = process.env.ADMIN_UPDATE_STATUS_FILE ?? '/opt/htown/logs/update-status.json';

type UpdateStatus = {
  status: 'unknown' | 'running' | 'success' | 'failed' | 'blocked';
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  commit?: string;
};

const readStatus = async (): Promise<UpdateStatus> => {
  try {
    const raw = await fs.readFile(UPDATE_STATUS_FILE, 'utf-8');
    return JSON.parse(raw) as UpdateStatus;
  } catch {
    return { status: 'unknown' };
  }
};

export async function registerUpdateRoutes(app: FastifyInstance) {
  app.get(
    '/admin/update',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (_request, reply) => {
      const status = await readStatus();
      reply.send(status);
    }
  );

  app.post(
    '/admin/update',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (_request, reply) => {
      const status = await readStatus();
      if (status.status === 'running') {
        return reply.code(409).send({ error: 'UPDATE_IN_PROGRESS' });
      }
      try {
        await fs.access(UPDATE_SCRIPT);
      } catch {
        return reply.code(404).send({ error: 'UPDATE_SCRIPT_MISSING' });
      }
      const child = spawn(UPDATE_SCRIPT, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return reply.send({ ok: true, started: true });
    }
  );
}
