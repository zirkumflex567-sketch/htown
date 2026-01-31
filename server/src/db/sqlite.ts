import DatabaseDriver from "better-sqlite3";
import { nanoid } from "nanoid";
import type { AccountRow, Database, LeaderboardRow, RefreshTokenRow } from "./types";

export class SqliteDatabase implements Database {
  private db: DatabaseDriver.Database;

  constructor(filePath: string) {
    this.db = new DatabaseDriver(filePath);
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        best_score INTEGER NOT NULL DEFAULT 0,
        total_runs INTEGER NOT NULL DEFAULT 0,
        last_run TEXT
      );
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
      CREATE TABLE IF NOT EXISTS leaderboard (
        account_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
    `);
  }

  async createAccount(email: string, passwordHash: string): Promise<AccountRow> {
    const id = nanoid();
    const stmt = this.db.prepare(
      "INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)"
    );
    stmt.run(id, email, passwordHash);
    return {
      id,
      email,
      password_hash: passwordHash,
      best_score: 0,
      total_runs: 0,
      last_run: null,
    };
  }

  async findAccountByEmail(email: string): Promise<AccountRow | null> {
    const row = this.db.prepare("SELECT * FROM accounts WHERE email = ?").get(email);
    return row ?? null;
  }

  async findAccountById(id: string): Promise<AccountRow | null> {
    const row = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    return row ?? null;
  }

  async recordRun(
    accountId: string,
    score: number,
    stats: Record<string, unknown>
  ): Promise<void> {
    const now = Date.now();
    const best = this.db
      .prepare("SELECT best_score FROM accounts WHERE id = ?")
      .get(accountId) as { best_score: number } | undefined;
    const bestScore = Math.max(best?.best_score ?? 0, score);
    this.db
      .prepare(
        "UPDATE accounts SET best_score = ?, total_runs = total_runs + 1, last_run = ? WHERE id = ?"
      )
      .run(bestScore, JSON.stringify(stats), accountId);
    this.db
      .prepare("INSERT INTO leaderboard (account_id, score, created_at) VALUES (?, ?, ?)")
      .run(accountId, score, now);
  }

  async saveRefreshToken(accountId: string, token: string, expiresAt: number): Promise<void> {
    this.db
      .prepare("INSERT INTO refresh_tokens (id, account_id, token, expires_at) VALUES (?, ?, ?, ?)")
      .run(nanoid(), accountId, token, expiresAt);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    this.db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(token);
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRow | null> {
    const row = this.db
      .prepare("SELECT * FROM refresh_tokens WHERE token = ?")
      .get(token);
    return row ?? null;
  }

  async topScores(limit: number): Promise<LeaderboardRow[]> {
    const rows = this.db
      .prepare(
        "SELECT account_id, score, created_at FROM leaderboard ORDER BY score DESC LIMIT ?"
      )
      .all(limit) as LeaderboardRow[];
    return rows;
  }

  async bestScoreFor(accountId: string): Promise<number | null> {
    const row = this.db
      .prepare("SELECT best_score FROM accounts WHERE id = ?")
      .get(accountId) as { best_score: number } | undefined;
    return row ? row.best_score : null;
  }
}
