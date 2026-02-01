import { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { listAudit } from '../db/repos/audit';

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get('/audit', { preHandler: [requireAuth, requirePermission('audit:read')] }, async (request) => {
    const { page = '1', pageSize = '25' } = request.query as { page?: string; pageSize?: string };
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const { rows, total } = await listAudit(limit, offset);
    return {
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        actorId: row.actor_id,
        actorRole: row.actor_role ?? undefined,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        before: row.before_json ? JSON.parse(row.before_json) : null,
        after: row.after_json ? JSON.parse(row.after_json) : null,
        ip: row.ip
      })),
      pagination: {
        page: Number(page),
        pageSize: limit,
        total
      }
    };
  });
}
