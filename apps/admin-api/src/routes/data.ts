import { FastifyInstance } from 'fastify';
import { getDb } from '../db';
import { getGameDb } from '../db/gameDb';
import { requireAuth, requirePermission } from '../services/authMiddleware';

type TableConfig = {
  editableColumns?: string[];
  allowInsert?: boolean;
  allowDelete?: boolean;
};

const sources = {
  admin: {
    label: 'Admin DB',
    getClient: getDb,
    tables: {
      players: { allowInsert: true, allowDelete: true },
      rooms: { allowInsert: true, allowDelete: true },
      matches: { allowInsert: true, allowDelete: true },
      config_versions: { allowInsert: true, allowDelete: true }
    } satisfies Record<string, TableConfig>
  },
  game: {
    label: 'Game DB',
    getClient: getGameDb,
    tables: {
      users: {
        editableColumns: [
          'best_score',
          'total_runs',
          'total_kills',
          'best_wave',
          'best_boss_kills',
          'last_run_stats',
          'last_run_summary'
        ],
        allowInsert: false,
        allowDelete: true
      }
    } satisfies Record<string, TableConfig>
  }
};

const getSource = (sourceId: string) => {
  const source = (sources as Record<string, (typeof sources)[keyof typeof sources]>)[sourceId];
  if (!source) {
    throw new Error('INVALID_SOURCE');
  }
  return source;
};

const sanitizeTable = (table: string, source: typeof sources[keyof typeof sources]) => {
  const config = source.tables[table as keyof typeof source.tables];
  if (!config) {
    throw new Error('INVALID_TABLE');
  }
  return config;
};

const listTableInfo = async (db: Awaited<ReturnType<typeof getDb>>, table: string) => {
  const columns = await db.query<{ name: string; type: string; notnull: number; pk: number }>(
    `PRAGMA table_info("${table}")`
  );
  const primary = columns.find((col) => col.pk === 1)?.name ?? null;
  return { columns, primary };
};

const buildWhereForSearch = (
  columns: { name: string; type: string }[],
  query: string,
  allowedColumns?: string[]
) => {
  if (!query) return { clause: '', params: [] as any[] };
  const targetColumns = columns.filter((col) => {
    if (allowedColumns && !allowedColumns.includes(col.name)) return false;
    return col.type.toUpperCase().includes('TEXT');
  });
  if (targetColumns.length === 0) return { clause: '', params: [] as any[] };
  const clause = targetColumns.map((col) => `"${col.name}" LIKE ?`).join(' OR ');
  const params = targetColumns.map(() => `%${query}%`);
  return { clause: `WHERE ${clause}`, params };
};

export async function registerDataRoutes(app: FastifyInstance) {
  app.get(
    '/admin/data/sources',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (_request, reply) => {
      const data = Object.entries(sources).map(([id, source]) => ({
        id,
        label: source.label
      }));
      reply.send({ sources: data });
    }
  );

  app.get(
    '/admin/data/tables',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const { source: sourceId } = request.query as { source?: string };
      if (!sourceId) return reply.code(400).send({ error: 'SOURCE_REQUIRED' });
      const source = getSource(sourceId);
      const db = await source.getClient();
      if (db.provider !== 'sqlite') {
        return reply.code(503).send({ error: 'ONLY_SQLITE_SUPPORTED' });
      }
      const tables = await Promise.all(
        Object.keys(source.tables).map(async (table) => {
          const config = source.tables[table as keyof typeof source.tables];
          const info = await listTableInfo(db, table);
          const columns = info.columns
            .filter((col) => !config.editableColumns || config.editableColumns.includes(col.name) || col.pk === 1)
            .map((col) => ({
              name: col.name,
              type: col.type,
              notNull: Boolean(col.notnull),
              primaryKey: col.pk === 1,
              editable: (config.editableColumns ? config.editableColumns.includes(col.name) : true) && col.pk !== 1
            }));
          return {
            name: table,
            primaryKey: info.primary,
            columns,
            canInsert: config.allowInsert !== false,
            canUpdate: columns.some((col) => col.editable),
            canDelete: config.allowDelete !== false
          };
        })
      );
      reply.send({ tables });
    }
  );

  app.get(
    '/admin/data/rows',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const { source: sourceId, table, page = '1', pageSize = '50', q } = request.query as {
        source?: string;
        table?: string;
        page?: string;
        pageSize?: string;
        q?: string;
      };
      if (!sourceId || !table) return reply.code(400).send({ error: 'SOURCE_TABLE_REQUIRED' });
      const source = getSource(sourceId);
      const config = sanitizeTable(table, source);
      const db = await source.getClient();
      if (db.provider !== 'sqlite') {
        return reply.code(503).send({ error: 'ONLY_SQLITE_SUPPORTED' });
      }

      const info = await listTableInfo(db, table);
      const allowedColumns = config.editableColumns;
      const { clause, params } = buildWhereForSearch(info.columns, q ?? '', allowedColumns);
      const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
      const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

      const rows = await db.query<any>(
        `SELECT * FROM "${table}" ${clause} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      const totalRow = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM "${table}" ${clause}`,
        params
      );

      const filteredRows = rows.map((row) => {
        if (!allowedColumns) return row;
        const filtered: Record<string, any> = {};
        for (const col of info.columns) {
          if (col.pk === 1 || allowedColumns.includes(col.name)) {
            filtered[col.name] = row[col.name];
          }
        }
        return filtered;
      });

      reply.send({
        data: filteredRows,
        pagination: {
          page: Math.max(Number(page) || 1, 1),
          pageSize: limit,
          total: totalRow?.count ?? filteredRows.length
        },
        primaryKey: info.primary ?? null
      });
    }
  );

  app.post(
    '/admin/data/update',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const body = request.body as { source?: string; table?: string; id?: any; changes?: Record<string, any> };
      if (!body?.source || !body?.table || body.id === undefined || !body.changes) {
        return reply.code(400).send({ error: 'INVALID_INPUT' });
      }
      const source = getSource(body.source);
      const config = sanitizeTable(body.table, source);
      const db = await source.getClient();
      if (db.provider !== 'sqlite') {
        return reply.code(503).send({ error: 'ONLY_SQLITE_SUPPORTED' });
      }

      const info = await listTableInfo(db, body.table);
      const pk = info.primary;
      if (!pk) return reply.code(400).send({ error: 'NO_PRIMARY_KEY' });

      const allowed = config.editableColumns;
      const entries = Object.entries(body.changes).filter(([key]) => {
        if (key === pk) return false;
        if (!allowed) return true;
        return allowed.includes(key);
      });
      if (entries.length === 0) return reply.code(400).send({ error: 'NO_VALID_FIELDS' });

      const sets = entries.map(([key]) => `"${key}" = ?`).join(', ');
      const params = [...entries.map(([, value]) => value), body.id];
      await db.exec(`UPDATE "${body.table}" SET ${sets} WHERE "${pk}" = ?`, params);
      reply.send({ ok: true });
    }
  );

  app.post(
    '/admin/data/insert',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const body = request.body as { source?: string; table?: string; record?: Record<string, any> };
      if (!body?.source || !body?.table || !body.record) {
        return reply.code(400).send({ error: 'INVALID_INPUT' });
      }
      const source = getSource(body.source);
      const config = sanitizeTable(body.table, source);
      if (config.allowInsert === false) {
        return reply.code(403).send({ error: 'INSERT_DISABLED' });
      }
      const db = await source.getClient();
      if (db.provider !== 'sqlite') {
        return reply.code(503).send({ error: 'ONLY_SQLITE_SUPPORTED' });
      }

      const allowed = config.editableColumns;
      const entries = Object.entries(body.record).filter(([key]) => (allowed ? allowed.includes(key) : true));
      if (entries.length === 0) return reply.code(400).send({ error: 'NO_FIELDS' });

      const columns = entries.map(([key]) => `"${key}"`).join(', ');
      const placeholders = entries.map(() => '?').join(', ');
      const params = entries.map(([, value]) => value);
      await db.exec(`INSERT INTO "${body.table}" (${columns}) VALUES (${placeholders})`, params);
      reply.send({ ok: true });
    }
  );

  app.post(
    '/admin/data/delete',
    { preHandler: [requireAuth, requirePermission('admin:manage')] },
    async (request, reply) => {
      const body = request.body as { source?: string; table?: string; id?: any };
      if (!body?.source || !body?.table || body.id === undefined) {
        return reply.code(400).send({ error: 'INVALID_INPUT' });
      }
      const source = getSource(body.source);
      const config = sanitizeTable(body.table, source);
      if (config.allowDelete === false) {
        return reply.code(403).send({ error: 'DELETE_DISABLED' });
      }
      const db = await source.getClient();
      if (db.provider !== 'sqlite') {
        return reply.code(503).send({ error: 'ONLY_SQLITE_SUPPORTED' });
      }

      const info = await listTableInfo(db, body.table);
      const pk = info.primary;
      if (!pk) return reply.code(400).send({ error: 'NO_PRIMARY_KEY' });
      await db.exec(`DELETE FROM "${body.table}" WHERE "${pk}" = ?`, [body.id]);
      reply.send({ ok: true });
    }
  );
}
