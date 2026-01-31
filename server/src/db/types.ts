export type AccountRow = {
  id: string;
  email: string;
  password_hash: string;
  best_score: number;
  total_runs: number;
  last_run: string | null;
};

export type RefreshTokenRow = {
  id: string;
  account_id: string;
  token: string;
  expires_at: number;
};

export type LeaderboardRow = {
  account_id: string;
  score: number;
  created_at: number;
};

export type Database = {
  init(): Promise<void>;
  createAccount(email: string, passwordHash: string): Promise<AccountRow>;
  findAccountByEmail(email: string): Promise<AccountRow | null>;
  findAccountById(id: string): Promise<AccountRow | null>;
  recordRun(accountId: string, score: number, stats: Record<string, unknown>): Promise<void>;
  saveRefreshToken(accountId: string, token: string, expiresAt: number): Promise<void>;
  revokeRefreshToken(token: string): Promise<void>;
  findRefreshToken(token: string): Promise<RefreshTokenRow | null>;
  topScores(limit: number): Promise<LeaderboardRow[]>;
  bestScoreFor(accountId: string): Promise<number | null>;
};
