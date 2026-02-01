import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { login, refresh, logout, hashPassword, verifyPassword } from '../services/auth';
import { requireAuth } from '../services/authMiddleware';
import { loginRequestSchema, changePasswordSchema } from '@htown/admin-shared';
import { findAdminById, findAdminByUsername, updateAdminPassword } from '../db/repos/adminUsers';
import { permissionsByRole } from '../rbac/permissions';

const refreshSchema = z.object({ refreshToken: z.string() });

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    try {
      const response = await login(body.username, body.password);
      reply.send(response);
    } catch (error) {
      reply.code(401).send({ error: (error as Error).message });
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    try {
      const tokens = await refresh(body.refreshToken);
      reply.send(tokens);
    } catch (error) {
      reply.code(401).send({ error: (error as Error).message });
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    await logout(body.refreshToken);
    reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const user = await findAdminById(request.user.sub);
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
        mustChangePassword: Boolean(user.must_change_password)
      },
      permissions: permissionsByRole[user.role]
    });
  });

  app.post('/auth/change-password', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const body = changePasswordSchema.parse(request.body);
    const user = await findAdminByUsername(request.user.username);
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    const valid = await verifyPassword(body.currentPassword, user.password_hash);
    if (!valid) return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    const nextHash = await hashPassword(body.nextPassword);
    await updateAdminPassword(user.id, nextHash, false);
    reply.send({ ok: true });
  });
}
