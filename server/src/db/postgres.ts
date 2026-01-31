import { nanoid } from "nanoid";
import pg from "pg";
import type { AccountRow, Database, LeaderboardRow, RefreshTokenRow } from "./types";

export class PostgresDatabase implements Database {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
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
        account_id TEXT NOT NULL REFERENCES accounts(id),
        token TEXT UNIQUE NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leaderboard (
        account_id TEXT NOT NULL REFERENCES accounts(id),
        score INTEGER NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
  }

  async createAccount(email: string, passwordHash: string): Promise<AccountRow> {
    const id = nanoid();
    await this.pool.query(
      "INSERT INTO accounts (id, email, password_hash) VALUES ($1, $2, $3)",
      [id, email, passwordHash]
    );
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
    const result = await this.pool.query("SELECT * FROM accounts WHERE email = $1", [email]);
    return (result.rows[0] as AccountRow) ?? null;
  }

  async findAccountById(id: string): Promise<AccountRow | null> {
    const result = await this.pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
    return (result.rows[0] as AccountRow) ?? null;
  }

  async recordRun(
    accountId: string,
    score: number,
    stats: Record<string, unknown>
  ): Promise<void> {
    const best = await this.pool.query("SELECT best_score FROM accounts WHERE id = $1", [
      accountId,
    ]);
    const bestScore = Math.max(best.rows[0]?.best_score ?? 0, score);
    await this.pool.query(
      "UPDATE accounts SET best_score = $1, total_runs = total_runs + 1, last_run = $2 WHERE id = $3",
      [bestScore, JSON.stringify(stats), accountId]
    );
    await this.pool.query(
      "INSERT INTO leaderboard (account_id, score, created_at) VALUES ($1, $2, $3)",
      [accountId, score, Date.now()]
    );
  }

  async saveRefreshToken(accountId: string, token: string, expiresAt: number): Promise<void> {
    await this.pool.query(
      "INSERT INTO refresh_tokens (id, account_id, token, expires_at) VALUES ($1, $2, $3, $4)",
      [nanoid(), accountId, token, expiresAt]
    );
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.pool.query("DELETE FROM refresh_tokens WHERE token = $1", [token]);
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRow | null> {
    const result = await this.pool.query("SELECT * FROM refresh_tokens WHERE token = $1", [token]);
    return (result.rows[0] as RefreshTokenRow) ?? null;
  }

  async topScores(limit: number): Promise<LeaderboardRow[]> {
    const result = await this.pool.query(
      "SELECT account_id, score, created_at FROM leaderboard ORDER BY score DESC LIMIT $1",
      [limit]
    );
    return result.rows as LeaderboardRow[];
  }

  async bestScoreFor(accountId: string): Promise<number | null> {
    const result = await this.pool.query("SELECT best_score FROM accounts WHERE id = $1", [
      accountId,
    ]);
    return result.rows[0]?.best_score ?? null;
  }
}
