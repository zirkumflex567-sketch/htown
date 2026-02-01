import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { env } from '../env';
import { requireAuth, requirePermission } from '../services/authMiddleware';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const safeRelative = (input: string) => {
  const normalized = path.posix.normalize(`/${input}`).slice(1);
  if (!normalized || normalized.startsWith('..') || normalized.includes('../')) {
    throw new Error('INVALID_PATH');
  }
  return normalized;
};

const ensureWithinRoot = (root: string, relPath: string) => {
  const target = path.resolve(root, relPath);
  const resolvedRoot = path.resolve(root);
  if (!target.startsWith(resolvedRoot)) {
    throw new Error('INVALID_PATH');
  }
  return target;
};

const listFiles = async (root: string, base = ''): Promise<Array<{ path: string; size: number; updatedAt: string }>> => {
  const dir = path.join(root, base);
  let entries: Array<{ path: string; size: number; updatedAt: string }> = [];
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of dirents) {
    if (entry.name.startsWith('.')) continue;
    const rel = base ? path.posix.join(base, entry.name) : entry.name;
    const full = path.join(root, rel);
    if (entry.isDirectory()) {
      entries = entries.concat(await listFiles(root, rel));
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      entries.push({ path: rel, size: stat.size, updatedAt: stat.mtime.toISOString() });
    }
  }
  return entries;
};

const assetUrl = (request: any, rel: string) => {
  const proto =
    (request.headers['x-forwarded-proto'] as string | undefined) ||
    (request.protocol as string | undefined) ||
    'http';
  const host = (request.headers['x-forwarded-host'] as string | undefined) || request.headers.host;
  return `${proto}://${host}/uploads/${rel}`;
};

export async function registerAssetRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE }
  });

  app.get(
    '/admin/assets',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const root = env.assetDir || '/opt/htown/uploads';
      await fs.mkdir(root, { recursive: true });
      const files = await listFiles(root);
      reply.send({
        data: files.map((entry) => ({
          ...entry,
          url: assetUrl(request, entry.path)
        }))
      });
    }
  );

  app.post(
    '/admin/assets',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const root = env.assetDir || '/opt/htown/uploads';
      await fs.mkdir(root, { recursive: true });
      const file = await (request as any).file();
      if (!file) return reply.code(400).send({ error: 'NO_FILE' });
      const fields = file.fields ?? {};
      const dirField = typeof fields.path?.value === 'string' ? fields.path.value : '';
      const nameField = typeof fields.name?.value === 'string' ? fields.name.value : '';
      const replace =
        typeof fields.replace?.value === 'string'
          ? fields.replace.value === 'true' || fields.replace.value === '1'
          : false;

      const baseDir = dirField ? safeRelative(dirField) : '';
      const filename = nameField || file.filename;
      if (!filename) return reply.code(400).send({ error: 'NO_FILENAME' });
      const relPath = baseDir ? path.posix.join(baseDir, filename) : filename;
      const safePath = safeRelative(relPath);
      const target = ensureWithinRoot(root, safePath);

      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        await fs.access(target);
        if (!replace) {
          return reply.code(409).send({ error: 'ALREADY_EXISTS' });
        }
      } catch {
        // file does not exist
      }

      await pipeline(file.file, createWriteStream(target));
      const stat = await fs.stat(target);
      reply.send({
        ok: true,
        asset: {
          path: safePath,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          url: assetUrl(request, safePath)
        }
      });
    }
  );

  app.delete(
    '/admin/assets',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const body = request.body as { path?: string };
      if (!body?.path) return reply.code(400).send({ error: 'INVALID_PATH' });
      const root = env.assetDir || '/opt/htown/uploads';
      const rel = safeRelative(body.path);
      const target = ensureWithinRoot(root, rel);
      try {
        await fs.unlink(target);
      } catch {
        return reply.code(404).send({ error: 'NOT_FOUND' });
      }
      reply.send({ ok: true });
    }
  );
}
