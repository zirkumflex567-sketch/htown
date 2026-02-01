import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';

export type PlayerRow = {
  id: string;
  display_name: string;
  created_at: string;
  last_seen_at: string | null;
  banned_until: string | null;
  muted_until: string | null;
  flags_json: string | null;
  notes: string | null;
};

const parseFlags = (row: PlayerRow) =>
  row.flags_json ? (JSON.parse(row.flags_json) as string[]) : [];

export async function listPlayers(params: { q?: string; limit: number; offset: number }) {
  const db = getDb();
  const q = params.q ? `%${params.q.toLowerCase()}%` : null;
  const rows = await db.query<PlayerRow>(
    q
      ? 'SELECT * FROM players WHERE lower(display_name) LIKE ? OR lower(id) LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM players ORDER BY created_at DESC LIMIT ? OFFSET ?',
    q ? [q, q, params.limit, params.offset] : [params.limit, params.offset]
  );
  const totalRow = await db.get<{ count: number }>(
    q
      ? 'SELECT COUNT(*) as count FROM players WHERE lower(display_name) LIKE ? OR lower(id) LIKE ?'
      : 'SELECT COUNT(*) as count FROM players',
    q ? [q, q] : []
  );
  return {
    rows: rows.map((row) => ({ ...row, flags_json: JSON.stringify(parseFlags(row)) })),
    total: totalRow?.count ?? 0
  };
}

export async function getPlayer(id: string) {
  const db = getDb();
  return db.get<PlayerRow>('SELECT * FROM players WHERE id = ?', [id]);
}

export async function upsertPlayer(input: {
  id?: string;
  displayName: string;
  createdAt?: string;
}) {
  const db = getDb();
  const id = input.id ?? nanoid();
  const createdAt = input.createdAt ?? nowIso();
  await db.exec(
    'INSERT INTO players (id, display_name, created_at, last_seen_at, flags_json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name',
    [id, input.displayName, createdAt, createdAt, JSON.stringify([])]
  );
  return id;
}

export async function updatePlayerBan(id: string, until: string | null) {
  const db = getDb();
  await db.exec('UPDATE players SET banned_until = ? WHERE id = ?', [until, id]);
}

export async function updatePlayerMute(id: string, until: string | null) {
  const db = getDb();
  await db.exec('UPDATE players SET muted_until = ? WHERE id = ?', [until, id]);
}

export async function updatePlayerNotes(id: string, notes: string | null) {
  const db = getDb();
  await db.exec('UPDATE players SET notes = ? WHERE id = ?', [notes, id]);
}

export async function updatePlayerFlags(id: string, flags: string[]) {
  const db = getDb();
  await db.exec('UPDATE players SET flags_json = ? WHERE id = ?', [JSON.stringify(flags), id]);
}
