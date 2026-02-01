import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.ADMIN_API_PORT, 8080),
  host: process.env.ADMIN_API_HOST ?? '0.0.0.0',
  corsOrigin: process.env.ADMIN_CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.ADMIN_JWT_SECRET ?? 'dev-admin-secret',
  jwtRefreshSecret: process.env.ADMIN_JWT_REFRESH_SECRET ?? 'dev-admin-refresh-secret',
  accessTokenTtl: process.env.ADMIN_ACCESS_TTL ?? '15m',
  refreshTokenTtl: process.env.ADMIN_REFRESH_TTL ?? '7d',
  defaultAdminUser: process.env.ADMIN_DEFAULT_USER ?? 'admin',
  defaultAdminPassword: process.env.ADMIN_DEFAULT_PASSWORD ?? 'admin123',
  dbProvider: (process.env.ADMIN_DB_PROVIDER ?? 'sqlite') as 'sqlite' | 'postgres',
  sqlitePath: process.env.ADMIN_SQLITE_PATH ?? './data/admin.sqlite',
  postgresUrl: process.env.ADMIN_POSTGRES_URL ?? '',
  logDir: process.env.ADMIN_LOG_DIR ?? './logs',
  logLevel: process.env.ADMIN_LOG_LEVEL ?? 'info',
  gameAdapter: (process.env.ADMIN_GAME_ADAPTER ?? 'stub') as 'stub' | 'none',
  webhookSecret: process.env.ADMIN_WEBHOOK_SECRET ?? '',
  webhookBranch: process.env.ADMIN_WEBHOOK_BRANCH ?? 'refs/heads/main',
  webhookRepo: process.env.ADMIN_WEBHOOK_REPO ?? '',
  gameDbPath: process.env.ADMIN_GAME_DB_PATH ?? '',
  assetDir: process.env.ADMIN_ASSET_DIR ?? '/opt/htown/uploads'
};
