# Htown Crew

Multiplayer co-op roguelite prototype built with Phaser 3, Vite, Colyseus, and Node.js.

## Requirements

- Node.js 20+
- pnpm (via Corepack: `corepack enable`)

## Setup

```bash
pnpm install
```

## Development

Run client + server together:

```bash
pnpm dev
```

- Client: http://localhost:5173
- Server: http://localhost:2567

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm test
```

## Docker

Run the server (SQLite) + Postgres container:

```bash
docker-compose up --build
```

The server uses SQLite by default. Postgres is included for future migration work.

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
