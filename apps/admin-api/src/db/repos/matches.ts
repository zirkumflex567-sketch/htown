import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';

export type MatchRow = {
  id: string;
  room_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  summary_json: string | null;
};

export async function listMatches(params: { q?: string; limit: number; offset: number }) {
  const db = getDb();
  const q = params.q ? `%${params.q.toLowerCase()}%` : null;
  const rows = await db.query<MatchRow>(
    q
      ? 'SELECT * FROM matches WHERE lower(id) LIKE ? OR lower(room_id) LIKE ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM matches ORDER BY started_at DESC LIMIT ? OFFSET ?',
    q ? [q, q, params.limit, params.offset] : [params.limit, params.offset]
  );
  const totalRow = await db.get<{ count: number }>(
    q
      ? 'SELECT COUNT(*) as count FROM matches WHERE lower(id) LIKE ? OR lower(room_id) LIKE ?'
      : 'SELECT COUNT(*) as count FROM matches',
    q ? [q, q] : []
  );
  return { rows, total: totalRow?.count ?? 0 };
}

export async function getMatch(id: string) {
  const db = getDb();
  return db.get<MatchRow>('SELECT * FROM matches WHERE id = ?', [id]);
}

export async function upsertMatch(input: {
  id?: string;
  roomId?: string | null;
  status: string;
  startedAt?: string;
  endedAt?: string | null;
  summary?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const id = input.id ?? nanoid();
  const startedAt = input.startedAt ?? nowIso();
  const summaryJson = input.summary ? JSON.stringify(input.summary) : null;
  await db.exec(
    'INSERT INTO matches (id, room_id, status, started_at, ended_at, summary_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, ended_at = excluded.ended_at, summary_json = excluded.summary_json',
    [id, input.roomId ?? null, input.status, startedAt, input.endedAt ?? null, summaryJson]
  );
  return id;
}

export async function updateMatchStatus(id: string, status: string) {
  const db = getDb();
  await db.exec('UPDATE matches SET status = ?, ended_at = ? WHERE id = ?', [status, nowIso(), id]);
}
