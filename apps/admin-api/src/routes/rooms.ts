import { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { roomActionSchema } from '@htown/admin-shared';
import { getGameAdapter } from '../services/gameService';
import { writeAudit } from '../db/repos/audit';

export async function registerRoomRoutes(app: FastifyInstance) {
  app.get('/rooms', { preHandler: [requireAuth, requirePermission('rooms:read')] }, async (request) => {
    const { q, page = '1', pageSize = '25' } = request.query as {
      q?: string;
      page?: string;
      pageSize?: string;
    };
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const result = await getGameAdapter().listRooms({ q, limit, offset });
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        playerCount: row.player_count,
        maxPlayers: row.max_players,
        mode: row.mode ?? undefined
      })),
      pagination: {
        page: Number(page),
        pageSize: limit,
        total: result.total
      }
    };
  });

  app.get('/rooms/:id', { preHandler: [requireAuth, requirePermission('rooms:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = await getGameAdapter().getRoom(id);
    if (!room) return reply.code(404).send({ error: 'NOT_FOUND' });
    return {
      id: room.id,
      status: room.status,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
      playerCount: room.player_count,
      maxPlayers: room.max_players,
      mode: room.mode ?? undefined
    };
  });

  app.post('/rooms/:id/action', { preHandler: [requireAuth, requirePermission('rooms:write')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const { id } = request.params as { id: string };
    const body = roomActionSchema.parse(request.body);
    const before = await getGameAdapter().getRoom(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await getGameAdapter().actOnRoom(id, body);
    const after = await getGameAdapter().getRoom(id);
    await writeAudit({
      actorId: request.user.sub,
      actorRole: request.user.role,
      action: `room.${body.action}`,
      targetType: 'room',
      targetId: id,
      before: before ? { status: before.status } : null,
      after: after ? { status: after.status } : null,
      ip: request.ip
    });
    return { ok: true };
  });
}
