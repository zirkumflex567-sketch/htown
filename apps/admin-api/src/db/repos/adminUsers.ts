import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { nowIso } from '../../utils/time';
import { Role } from '@htown/admin-shared';

export type AdminUserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  must_change_password: number;
  created_at: string;
  updated_at: string;
};

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  revoked_at: string | null;
};

export async function findAdminByUsername(username: string) {
  const db = getDb();
  return db.get<AdminUserRow>('SELECT * FROM admin_users WHERE username = ?', [username]);
}

export async function findAdminById(id: string) {
  const db = getDb();
  return db.get<AdminUserRow>('SELECT * FROM admin_users WHERE id = ?', [id]);
}

export async function listAdmins() {
  const db = getDb();
  return db.query<AdminUserRow>('SELECT * FROM admin_users ORDER BY created_at DESC');
}

export async function createAdminUser(input: {
  id?: string;
  username: string;
  passwordHash: string;
  role: Role;
  mustChangePassword?: boolean;
}) {
  const db = getDb();
  const id = input.id ?? nanoid();
  const now = nowIso();
  await db.exec(
    'INSERT INTO admin_users (id, username, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.username, input.passwordHash, input.role, input.mustChangePassword ? 1 : 0, now, now]
  );
  return { id };
}

export async function updateAdminPassword(id: string, passwordHash: string, mustChangePassword: boolean) {
  const db = getDb();
  await db.exec('UPDATE admin_users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?', [
    passwordHash,
    mustChangePassword ? 1 : 0,
    nowIso(),
    id
  ]);
}

export async function setMustChangePassword(id: string, mustChangePassword: boolean) {
  const db = getDb();
  await db.exec('UPDATE admin_users SET must_change_password = ?, updated_at = ? WHERE id = ?', [
    mustChangePassword ? 1 : 0,
    nowIso(),
    id
  ]);
}

export async function saveRefreshToken(userId: string, tokenHash: string) {
  const db = getDb();
  const id = nanoid();
  await db.exec(
    'INSERT INTO admin_refresh_tokens (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)',
    [id, userId, tokenHash, nowIso()]
  );
  return id;
}

export async function findRefreshToken(tokenHash: string) {
  const db = getDb();
  return db.get<RefreshTokenRow>('SELECT * FROM admin_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL', [
    tokenHash
  ]);
}

export async function revokeRefreshToken(tokenId: string) {
  const db = getDb();
  await db.exec('UPDATE admin_refresh_tokens SET revoked_at = ? WHERE id = ?', [nowIso(), tokenId]);
}

export async function revokeAllRefreshTokens(userId: string) {
  const db = getDb();
  await db.exec('UPDATE admin_refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
    nowIso(),
    userId
  ]);
}
