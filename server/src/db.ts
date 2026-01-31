import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from './env';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  best_score: number;
  total_runs: number;
  last_run_stats: string | null;
  refresh_token: string | null;
}

mkdirSync(dirname(env.sqlitePath), { recursive: true });
const db = new Database(env.sqlitePath);

export function initDb() {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      best_score INTEGER DEFAULT 0,
      total_runs INTEGER DEFAULT 0,
      last_run_stats TEXT,
      refresh_token TEXT
    );
  `);
}

export function createUser(user: UserRow) {
  const stmt = db.prepare(
    'INSERT INTO users (id, email, password_hash, best_score, total_runs, last_run_stats, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?)' 
  );
  stmt.run(user.id, user.email, user.password_hash, user.best_score, user.total_runs, user.last_run_stats, user.refresh_token);
}

export function findUserByEmail(email: string) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as UserRow | undefined;
}

export function findUserById(id: string) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as UserRow | undefined;
}

export function updateRefreshToken(userId: string, token: string | null) {
  const stmt = db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?');
  stmt.run(token, userId);
}

export function updateRunStats(userId: string, score: number, runStats: string) {
  const user = findUserById(userId);
  if (!user) return;
  const bestScore = Math.max(user.best_score ?? 0, score);
  const totalRuns = (user.total_runs ?? 0) + 1;
  const stmt = db.prepare('UPDATE users SET best_score = ?, total_runs = ?, last_run_stats = ? WHERE id = ?');
  stmt.run(bestScore, totalRuns, runStats, userId);
}

export function getLeaderboard(limit = 50) {
  const stmt = db.prepare('SELECT id, email, best_score as bestScore, total_runs as totalRuns FROM users ORDER BY best_score DESC LIMIT ?');
  return stmt.all(limit);
}

export default db;
