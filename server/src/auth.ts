import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { env } from './env';
import { createUser, findUserByEmail, findUserById, updateRefreshToken } from './db';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.accessTokenTtl });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtRefreshSecret, { expiresIn: env.refreshTokenTtl });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as { sub: string };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

export async function register(email: string, password: string) {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }
  const passwordHash = await hashPassword(password);
  const id = nanoid();
  createUser({
    id,
    email,
    password_hash: passwordHash,
    best_score: 0,
    total_runs: 0,
    total_kills: 0,
    best_wave: 0,
    best_boss_kills: 0,
    last_run_stats: null,
    last_run_summary: null,
    refresh_token: null
  });
  const accessToken = signAccessToken(id);
  const refreshToken = signRefreshToken(id);
  updateRefreshToken(id, refreshToken);
  return { accessToken, refreshToken, userId: id };
}

export async function login(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  updateRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken, userId: user.id };
}

export function refresh(token: string) {
  const payload = verifyRefreshToken(token);
  const user = findUserById(payload.sub);
  if (!user || user.refresh_token !== token) {
    throw new Error('INVALID_REFRESH');
  }
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  updateRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken, userId: user.id };
}

export function logout(userId: string) {
  updateRefreshToken(userId, null);
}
