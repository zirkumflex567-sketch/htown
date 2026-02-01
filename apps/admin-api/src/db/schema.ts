export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
  );`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    before_json TEXT,
    after_json TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS config_versions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    created_by TEXT,
    message TEXT NOT NULL,
    data_json TEXT NOT NULL,
    previous_version_id TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    banned_until TEXT,
    muted_until TEXT,
    flags_json TEXT,
    notes TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    player_count INTEGER NOT NULL,
    max_players INTEGER NOT NULL,
    mode TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    summary_json TEXT
  );`
];

export const indexStatements = [
  `CREATE INDEX IF NOT EXISTS idx_players_display_name ON players (display_name);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);`,
  `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);`
];
