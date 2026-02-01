import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_json: string | null;
  after_json: string | null;
  ip: string | null;
  created_at: string;
};

export async function writeAudit(entry: {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
}) {
  const db = getDb();
  await db.exec(
    'INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, before_json, after_json, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      nanoid(),
      entry.actorId,
      entry.actorRole,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.before ? JSON.stringify(entry.before) : null,
      entry.after ? JSON.stringify(entry.after) : null,
      entry.ip,
      nowIso()
    ]
  );
}

export async function listAudit(limit = 50, offset = 0) {
  const db = getDb();
  const rows = await db.query<AuditRow>(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const totalRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs');
  return { rows, total: totalRow?.count ?? 0 };
}
