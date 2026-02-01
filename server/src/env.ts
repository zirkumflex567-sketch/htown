export const env = {
  port: Number(process.env.PORT ?? 2567),
  host: process.env.HOST ?? '0.0.0.0',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  adminToken:
    process.env.ADMIN_TOKEN ??
    (process.env.NODE_ENV !== 'production' ? 'dev-admin' : ''),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
  sqlitePath: process.env.SQLITE_PATH ?? './data/htown.sqlite'
};
