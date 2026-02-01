import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { env } from '../env';
import {
  createAdminUser,
  findAdminById,
  findAdminByUsername,
  revokeAllRefreshTokens,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken
} from '../db/repos/adminUsers';
import { Role } from '@htown/admin-shared';
import { logger } from '../logging/logger';

export type AuthPayload = {
  sub: string;
  username: string;
  role: Role;
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = async (password: string, hash: string) => bcrypt.compare(password, hash);

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (payload: AuthPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl });

export const signRefreshToken = (payload: AuthPayload) =>
  jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.refreshTokenTtl });

export const verifyAccessToken = (token: string) => jwt.verify(token, env.jwtSecret) as AuthPayload;
export const verifyRefreshToken = (token: string) => jwt.verify(token, env.jwtRefreshSecret) as AuthPayload;

export async function ensureDefaultAdmin() {
  const existing = await findAdminByUsername(env.defaultAdminUser);
  if (existing) return existing;
  const passwordHash = await hashPassword(env.defaultAdminPassword);
  const created = await createAdminUser({
    id: nanoid(),
    username: env.defaultAdminUser,
    passwordHash,
    role: 'OWNER',
    mustChangePassword: true
  });
  logger.log('warn', 'Default admin created. Change password on first login.', {
    username: env.defaultAdminUser
  });
  return findAdminById(created.id);
}

export async function login(username: string, password: string) {
  const user = await findAdminByUsername(username);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const payload: AuthPayload = { sub: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await revokeAllRefreshTokens(user.id);
  await saveRefreshToken(user.id, hashToken(refreshToken));
  return {
    accessToken,
    refreshToken,
    mustChangePassword: Boolean(user.must_change_password),
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenRow = await findRefreshToken(hashToken(refreshToken));
  if (!tokenRow) {
    throw new Error('INVALID_REFRESH');
  }
  await revokeRefreshToken(tokenRow.id);
  const accessToken = signAccessToken(payload);
  const nextRefreshToken = signRefreshToken(payload);
  await saveRefreshToken(payload.sub, hashToken(nextRefreshToken));
  return { accessToken, refreshToken: nextRefreshToken };
}

export async function logout(refreshToken: string) {
  try {
    const tokenRow = await findRefreshToken(hashToken(refreshToken));
    if (tokenRow) await revokeRefreshToken(tokenRow.id);
  } catch {
    // ignore
  }
}
