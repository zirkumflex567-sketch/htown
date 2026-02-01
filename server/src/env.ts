export const env = {
  port: Number(process.env.PORT ?? 2567),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
  sqlitePath: process.env.SQLITE_PATH ?? './data/htown.sqlite'
};
