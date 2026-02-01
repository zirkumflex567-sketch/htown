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
  total_kills: number;
  best_wave: number;
  best_boss_kills: number;
  last_run_stats: string | null;
  last_run_summary: string | null;
  refresh_token: string | null;
}

let db: Database | null = null;

function getDb() {
  if (!db) {
    mkdirSync(dirname(env.sqlitePath), { recursive: true });
    db = new Database(env.sqlitePath);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function initDb() {
  const db = getDb();
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      best_score INTEGER DEFAULT 0,
      total_runs INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      best_wave INTEGER DEFAULT 0,
      best_boss_kills INTEGER DEFAULT 0,
      last_run_stats TEXT,
      last_run_summary TEXT,
      refresh_token TEXT
    );
  `);

  const columns = new Set(
    db
      .prepare("PRAGMA table_info(users)")
      .all()
      .map((row: { name: string }) => row.name)
  );
  if (!columns.has('total_kills')) db.exec('ALTER TABLE users ADD COLUMN total_kills INTEGER DEFAULT 0');
  if (!columns.has('best_wave')) db.exec('ALTER TABLE users ADD COLUMN best_wave INTEGER DEFAULT 0');
  if (!columns.has('best_boss_kills')) db.exec('ALTER TABLE users ADD COLUMN best_boss_kills INTEGER DEFAULT 0');
  if (!columns.has('last_run_summary')) db.exec('ALTER TABLE users ADD COLUMN last_run_summary TEXT');
}

export function createUser(user: UserRow) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO users (id, email, password_hash, best_score, total_runs, total_kills, best_wave, best_boss_kills, last_run_stats, last_run_summary, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' 
  );
  stmt.run(
    user.id,
    user.email,
    user.password_hash,
    user.best_score,
    user.total_runs,
    user.total_kills,
    user.best_wave,
    user.best_boss_kills,
    user.last_run_stats,
    user.last_run_summary,
    user.refresh_token
  );
}

export function findUserByEmail(email: string) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as UserRow | undefined;
}

export function findUserById(id: string) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as UserRow | undefined;
}

export function updateRefreshToken(userId: string, token: string | null) {
  const db = getDb();
  const stmt = db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?');
  stmt.run(token, userId);
}

export function updateRunStats(
  userId: string,
  stats: { score: number; kills: number; wave: number; bossKills: number; summary: string }
) {
  const user = findUserById(userId);
  if (!user) return;
  const bestScore = Math.max(user.best_score ?? 0, stats.score);
  const totalRuns = (user.total_runs ?? 0) + 1;
  const totalKills = (user.total_kills ?? 0) + stats.kills;
  const bestWave = Math.max(user.best_wave ?? 0, stats.wave);
  const bestBossKills = Math.max(user.best_boss_kills ?? 0, stats.bossKills);
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE users SET best_score = ?, total_runs = ?, total_kills = ?, best_wave = ?, best_boss_kills = ?, last_run_stats = ?, last_run_summary = ? WHERE id = ?'
  );
  stmt.run(
    bestScore,
    totalRuns,
    totalKills,
    bestWave,
    bestBossKills,
    stats.summary,
    stats.summary,
    userId
  );
}

export function getLeaderboard(limit = 50) {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, email, best_score as bestScore, total_runs as totalRuns, total_kills as totalKills, best_wave as bestWave, best_boss_kills as bestBossKills FROM users ORDER BY best_score DESC LIMIT ?'
  );
  return stmt.all(limit);
}

export function getUserStats(userId: string) {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, email, best_score as bestScore, total_runs as totalRuns, total_kills as totalKills, best_wave as bestWave, best_boss_kills as bestBossKills, last_run_summary as lastRunSummary FROM users WHERE id = ?'
  );
  return stmt.get(userId);
}
