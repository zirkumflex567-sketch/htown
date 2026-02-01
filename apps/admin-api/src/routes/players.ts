import { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { banRequestSchema, flagsRequestSchema, muteRequestSchema, notesRequestSchema } from '@htown/admin-shared';
import { getGameAdapter } from '../services/gameService';
import { writeAudit } from '../db/repos/audit';

export async function registerPlayerRoutes(app: FastifyInstance) {
  app.get('/players', { preHandler: [requireAuth, requirePermission('players:read')] }, async (request) => {
    const { q, page = '1', pageSize = '25' } = request.query as {
      q?: string;
      page?: string;
      pageSize?: string;
    };
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const adapter = getGameAdapter();
    const result = await adapter.listPlayers({ q, limit, offset });
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        bannedUntil: row.banned_until,
        mutedUntil: row.muted_until,
        flags: row.flags_json ? JSON.parse(row.flags_json) : [],
        notes: row.notes
      })),
      pagination: {
        page: Number(page),
        pageSize: limit,
        total: result.total
      }
    };
  });

  app.get('/players/:id', { preHandler: [requireAuth, requirePermission('players:read')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await getGameAdapter().getPlayer(id);
    if (!player) return reply.code(404).send({ error: 'NOT_FOUND' });
    return {
      id: player.id,
      displayName: player.display_name,
      createdAt: player.created_at,
      lastSeenAt: player.last_seen_at,
      bannedUntil: player.banned_until,
      mutedUntil: player.muted_until,
      flags: player.flags_json ? JSON.parse(player.flags_json) : [],
      notes: player.notes
    };
  });

  app.post('/players/:id/ban', { preHandler: [requireAuth, requirePermission('players:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = banRequestSchema.parse(request.body);
    const adapter = getGameAdapter();
    const before = await adapter.getPlayer(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await adapter.banPlayer(id, body);
    const after = await adapter.getPlayer(id);
    if (request.user) {
      await writeAudit({
        actorId: request.user.sub,
        actorRole: request.user.role,
        action: 'player.ban',
        targetType: 'player',
        targetId: id,
        before: before ? { bannedUntil: before.banned_until } : null,
        after: after ? { bannedUntil: after.banned_until } : null,
        ip: request.ip
      });
    }
    return { ok: true };
  });

  app.post('/players/:id/mute', { preHandler: [requireAuth, requirePermission('players:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = muteRequestSchema.parse(request.body);
    const adapter = getGameAdapter();
    const before = await adapter.getPlayer(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await adapter.mutePlayer(id, body);
    const after = await adapter.getPlayer(id);
    if (request.user) {
      await writeAudit({
        actorId: request.user.sub,
        actorRole: request.user.role,
        action: 'player.mute',
        targetType: 'player',
        targetId: id,
        before: before ? { mutedUntil: before.muted_until } : null,
        after: after ? { mutedUntil: after.muted_until } : null,
        ip: request.ip
      });
    }
    return { ok: true };
  });

  app.post('/players/:id/notes', { preHandler: [requireAuth, requirePermission('players:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = notesRequestSchema.parse(request.body);
    const adapter = getGameAdapter();
    const before = await adapter.getPlayer(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await adapter.updatePlayerNotes(id, body);
    const after = await adapter.getPlayer(id);
    if (request.user) {
      await writeAudit({
        actorId: request.user.sub,
        actorRole: request.user.role,
        action: 'player.notes',
        targetType: 'player',
        targetId: id,
        before: before ? { notes: before.notes } : null,
        after: after ? { notes: after.notes } : null,
        ip: request.ip
      });
    }
    return { ok: true };
  });

  app.post('/players/:id/flags', { preHandler: [requireAuth, requirePermission('players:write')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = flagsRequestSchema.parse(request.body);
    const adapter = getGameAdapter();
    const before = await adapter.getPlayer(id);
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    await adapter.updatePlayerFlags(id, body);
    const after = await adapter.getPlayer(id);
    if (request.user) {
      await writeAudit({
        actorId: request.user.sub,
        actorRole: request.user.role,
        action: 'player.flags',
        targetType: 'player',
        targetId: id,
        before: before ? { flags: before.flags_json ? JSON.parse(before.flags_json) : [] } : null,
        after: after ? { flags: after.flags_json ? JSON.parse(after.flags_json) : [] } : null,
        ip: request.ip
      });
    }
    return { ok: true };
  });
}
