import { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { matchActionSchema } from '@htown/admin-shared';
import { getGameAdapter } from '../services/gameService';
import { writeAudit } from '../db/repos/audit';

export async function registerMatchRoutes(app: FastifyInstance) {
  app.get('/matches', { preHandler: [requireAuth, requirePermission('matches:read')] }, async (request) => {
    const { q, page = '1', pageSize = '25' } = request.query as {
      q?: string;
      page?: string;
      pageSize?: string;
    };
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const result = await getGameAdapter().listMatches({ q, limit, offset });
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        roomId: row.room_id,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        summary: row.summary_json ? JSON.parse(row.summary_json) : null
      })),
      pagination: {
        page: Number(page),
        pageSize: limit,
        total: result.total
      }
    };
  });

  app.get('/matches/:id', { preHandler: [requireAuth, requirePermission('matches:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await getGameAdapter().getMatch(id);
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    return {
      id: match.id,
      roomId: match.room_id,
      status: match.status,
      startedAt: match.started_at,
      endedAt: match.ended_at,
      summary: match.summary_json ? JSON.parse(match.summary_json) : null
    };
  });

  app.post('/matches/:id/action', { preHandler: [requireAuth, requirePermission('matches:write')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const { id } = request.params as { id: string };
    const body = matchActionSchema.parse(request.body);
    const before = await getGameAdapter().getMatch(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await getGameAdapter().actOnMatch(id, body);
    const after = await getGameAdapter().getMatch(id);
    await writeAudit({
      actorId: request.user.sub,
      actorRole: request.user.role,
      action: `match.${body.action}`,
      targetType: 'match',
      targetId: id,
      before: before ? { status: before.status } : null,
      after: after ? { status: after.status } : null,
      ip: request.ip
    });
    return { ok: true };
  });
}
