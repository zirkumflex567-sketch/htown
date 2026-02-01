import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';

export type RoomRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  player_count: number;
  max_players: number;
  mode: string | null;
};

export async function listRooms(params: { q?: string; limit: number; offset: number }) {
  const db = getDb();
  const q = params.q ? `%${params.q.toLowerCase()}%` : null;
  const rows = await db.query<RoomRow>(
    q
      ? 'SELECT * FROM rooms WHERE lower(id) LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM rooms ORDER BY created_at DESC LIMIT ? OFFSET ?',
    q ? [q, params.limit, params.offset] : [params.limit, params.offset]
  );
  const totalRow = await db.get<{ count: number }>(
    q ? 'SELECT COUNT(*) as count FROM rooms WHERE lower(id) LIKE ?' : 'SELECT COUNT(*) as count FROM rooms',
    q ? [q] : []
  );
  return { rows, total: totalRow?.count ?? 0 };
}

export async function getRoom(id: string) {
  const db = getDb();
  return db.get<RoomRow>('SELECT * FROM rooms WHERE id = ?', [id]);
}

export async function upsertRoom(input: {
  id?: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  mode?: string | null;
}) {
  const db = getDb();
  const id = input.id ?? nanoid();
  const now = nowIso();
  await db.exec(
    'INSERT INTO rooms (id, status, created_at, updated_at, player_count, max_players, mode) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, player_count = excluded.player_count, max_players = excluded.max_players, mode = excluded.mode',
    [id, input.status, now, now, input.playerCount, input.maxPlayers, input.mode ?? null]
  );
  return id;
}

export async function updateRoomStatus(id: string, status: string) {
  const db = getDb();
  await db.exec('UPDATE rooms SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), id]);
}
