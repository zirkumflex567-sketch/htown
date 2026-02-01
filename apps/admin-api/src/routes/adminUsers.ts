import { FastifyInstance } from 'fastify';
import { adminUserCreateSchema } from '@htown/admin-shared';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { createAdminUser, listAdmins } from '../db/repos/adminUsers';
import { hashPassword } from '../services/auth';
import { writeAudit } from '../db/repos/audit';

export async function registerAdminUserRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: [requireAuth, requirePermission('admin:manage')] }, async () => {
    const users = await listAdmins();
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
      mustChangePassword: Boolean(user.must_change_password)
    }));
  });

  app.post('/admin/users', { preHandler: [requireAuth, requirePermission('admin:manage')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const body = adminUserCreateSchema.parse(request.body);
    const passwordHash = await hashPassword(body.password);
    let created: { id: string } | null = null;
    try {
      created = await createAdminUser({
        username: body.username,
        passwordHash,
        role: body.role,
        mustChangePassword: true
      });
    } catch (error) {
      return reply.code(409).send({ error: 'USERNAME_TAKEN' });
    }
    await writeAudit({
      actorId: request.user.sub,
      actorRole: request.user.role,
      action: 'admin.create',
      targetType: 'admin_user',
      targetId: created.id,
      before: null,
      after: { username: body.username, role: body.role },
      ip: request.ip
    });
    return { id: created.id };
  });
}
