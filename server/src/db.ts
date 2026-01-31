import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  bestScore: number;
  totalRuns: number;
  lastRunJson: string | null;
};

export class DatabaseLayer {
  private db: Database.Database;

  constructor(dbPath = path.join(process.cwd(), 'data', 'game.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        best_score INTEGER NOT NULL DEFAULT 0,
        total_runs INTEGER NOT NULL DEFAULT 0,
        last_run_json TEXT
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        summary_json TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
  }

  createUser(id: string, email: string, passwordHash: string) {
    const stmt = this.db.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    );
    stmt.run(id, email, passwordHash);
  }

  getUserByEmail(email: string): UserRecord | undefined {
    const row = this.db
      .prepare('SELECT id, email, password_hash as passwordHash, best_score as bestScore, total_runs as totalRuns, last_run_json as lastRunJson FROM users WHERE email = ?')
      .get(email);
    return row as UserRecord | undefined;
  }

  getUserById(id: string): UserRecord | undefined {
    const row = this.db
      .prepare('SELECT id, email, password_hash as passwordHash, best_score as bestScore, total_runs as totalRuns, last_run_json as lastRunJson FROM users WHERE id = ?')
      .get(id);
    return row as UserRecord | undefined;
  }

  saveRefreshToken(token: string, userId: string, expiresAt: number) {
    this.db
      .prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, expiresAt);
  }

  consumeRefreshToken(token: string) {
    const row = this.db
      .prepare('SELECT token, user_id as userId, expires_at as expiresAt FROM refresh_tokens WHERE token = ?')
      .get(token) as { token: string; userId: string; expiresAt: number } | undefined;
    if (!row) {
      return undefined;
    }
    this.db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
    return row;
  }

  createRun(runId: string, userId: string, score: number, summary: Record<string, unknown>) {
    const now = Date.now();
    this.db
      .prepare('INSERT INTO runs (id, user_id, score, created_at, summary_json) VALUES (?, ?, ?, ?, ?)')
      .run(runId, userId, score, now, JSON.stringify(summary));

    const user = this.getUserById(userId);
    if (!user) {
      return;
    }
    const bestScore = Math.max(user.bestScore, score);
    this.db
      .prepare('UPDATE users SET best_score = ?, total_runs = total_runs + 1, last_run_json = ? WHERE id = ?')
      .run(bestScore, JSON.stringify(summary), userId);
  }

  listTopScores(limit = 50) {
    return this.db
      .prepare('SELECT user_id as userId, score, created_at as createdAt FROM runs ORDER BY score DESC LIMIT ?')
      .all(limit) as Array<{ userId: string; score: number; createdAt: number }>;
  }
}
