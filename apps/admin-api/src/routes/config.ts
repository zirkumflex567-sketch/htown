import { FastifyInstance } from 'fastify';
import { configPublishSchema, configRollbackSchema } from '@htown/admin-shared';
import { requireAuth, requirePermission } from '../services/authMiddleware';
import { createConfigVersion, getConfigVersionById, getLatestConfigVersion, listConfigVersions } from '../db/repos/config';
import { ensureConfigVersion, validateConfig } from '../services/config';
import { writeAudit } from '../db/repos/audit';

export async function registerConfigRoutes(app: FastifyInstance) {
  app.get('/config/current', { preHandler: [requireAuth, requirePermission('config:read')] }, async () => {
    const current = await ensureConfigVersion();
    if (!current) return null;
    return {
      id: current.id,
      createdAt: current.created_at,
      createdBy: current.created_by,
      message: current.message,
      data: JSON.parse(current.data_json),
      previousVersionId: current.previous_version_id
    };
  });

  app.get('/config/versions', { preHandler: [requireAuth, requirePermission('config:read')] }, async (request) => {
    const { limit } = request.query as { limit?: string };
    const versions = await listConfigVersions(limit ? Number(limit) : 25);
    return versions.map((version) => ({
      id: version.id,
      createdAt: version.created_at,
      createdBy: version.created_by,
      message: version.message,
      data: JSON.parse(version.data_json),
      previousVersionId: version.previous_version_id
    }));
  });

  app.post('/config/publish', { preHandler: [requireAuth, requirePermission('config:write')] }, async (request) => {
    if (!request.user) return { error: 'UNAUTHORIZED' };
    const body = configPublishSchema.parse(request.body);
    const validated = validateConfig(body.data);
    const latest = await getLatestConfigVersion();
    const id = await createConfigVersion({
      data: validated,
      message: body.message,
      createdBy: request.user.sub,
      previousVersionId: latest?.id ?? null
    });
    await writeAudit({
      actorId: request.user.sub,
      actorRole: request.user.role,
      action: 'config.publish',
      targetType: 'config',
      targetId: id,
      before: latest ? JSON.parse(latest.data_json) : null,
      after: validated,
      ip: request.ip
    });
    const created = await getConfigVersionById(id);
    return {
      id: created?.id,
      createdAt: created?.created_at,
      createdBy: created?.created_by,
      message: created?.message,
      data: created ? JSON.parse(created.data_json) : validated,
      previousVersionId: created?.previous_version_id ?? null
    };
  });

  app.post('/config/rollback', { preHandler: [requireAuth, requirePermission('config:write')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    const body = configRollbackSchema.parse(request.body);
    const target = await getConfigVersionById(body.versionId);
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });
    const validated = validateConfig(JSON.parse(target.data_json));
    const latest = await getLatestConfigVersion();
    const id = await createConfigVersion({
      data: validated,
      message: body.message,
      createdBy: request.user.sub,
      previousVersionId: latest?.id ?? null
    });
    await writeAudit({
      actorId: request.user.sub,
      actorRole: request.user.role,
      action: 'config.rollback',
      targetType: 'config',
      targetId: id,
      before: latest ? JSON.parse(latest.data_json) : null,
      after: validated,
      ip: request.ip
    });
    const created = await getConfigVersionById(id);
    return {
      id: created?.id,
      createdAt: created?.created_at,
      createdBy: created?.created_by,
      message: created?.message,
      data: created ? JSON.parse(created.data_json) : validated,
      previousVersionId: created?.previous_version_id ?? null
    };
  });
}
