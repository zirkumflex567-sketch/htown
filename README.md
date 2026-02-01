# Htown Crew

Multiplayer co-op roguelite prototype plus a production-style Admin Suite for live ops.

## Requirements

- Node.js 20+
- npm or pnpm (Corepack optional)

## Setup

```bash
npm install
```

## Development

Admin Suite (API + Web UI):

```bash
npm run dev
```

- Admin UI: http://localhost:5173
- Admin API: http://localhost:8080
- API Docs: http://localhost:8080/docs

Game client + server:

```bash
npm run dev:game
```

- Game Client: http://localhost:5173
- Game Server: http://localhost:2567

Quick start scripts (auto-open browser after health OK):

- Windows: `start_admin.bat`, `start_server.bat`
- macOS/Linux: `./start_admin.sh`, `./start_server.sh` (run `chmod +x` first)

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

Game tests:

```bash
npm run test:game
```

Admin API tests:

```bash
npm run test -w apps/admin-api
```

## Docker

Run the server (SQLite) + Postgres container:

```bash
docker-compose up --build
```

The server uses SQLite by default. Postgres is included for future migration work.

## Admin Suite (Notes)

- Admin API uses SQLite by default (`ADMIN_SQLITE_PATH`).
- Optional Postgres via `ADMIN_DB_PROVIDER=postgres` and `ADMIN_POSTGRES_URL`.
- `ADMIN_GAME_ADAPTER=stub` provides demo players/rooms/matches and emits sample logs.
- Adapter layer lives in `apps/admin-api/src/adapters/` for real game server integration.
- Default admin user is created on first run:
  - username: `admin`
  - password: `admin123`
  - must change password on first login.

See `.env.example` for all configuration options.

## Playing

1. Register or login.
2. Quick Play joins any available room.
3. Create Room generates a room code and joins it.
4. Join Room enters an existing code.

Only your assigned station is interactive; the full crew console is visible to all players.

## Assets

Placeholder assets are generated automatically. You can download free packs from Kenney and drop them into `client/public/assets`.

To generate a placeholder file:

```bash
node client/scripts/download_assets.ts
```

See `assets/THIRD_PARTY.md` for attribution.
