# H-Town Coop Roguelite (Prototype)

A mobile-first, browser-based co-op roguelite prototype using Phaser 3 + Colyseus. One shared ship, five seats, forced seat swaps, bots for missing stations, and a single shared UI.

## Requirements
- Node.js 20+
- npm 9+

## Install
```bash
npm install
```

## Development
```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:2567

## Build
```bash
npm run build
```

## Run server with Docker Compose
```bash
docker-compose up --build
```

## Optional assets
```bash
npm run assets --workspace client
```

If the asset download fails, the game still renders procedural shapes.

## How to Play
1. Open the client and register/login.
2. Create a room or quick play.
3. Use the on-screen HUD for your assigned seat. Other seats remain visible but read-only.

### Controls
- **Pilot**: hold left click/touch to steer; space to boost.
- **Gunner**: mouse/touch to aim, click/tap to fire.
- **Power**: keys 1/2/3 for energy presets.
- **Systems**: Q/W/E to trigger abilities.
- **Support**: R/T/Y for repair/scan/loot.
- **Upgrades**: press 1/2/3 to choose.

## Environment Variables
Create `server/.env` if needed. Defaults are safe for local development.
```
PORT=2567
JWT_SECRET=dev-secret
DB_MODE=sqlite
SQLITE_FILE=./data/dev.db
# DB_MODE=postgres
# DATABASE_URL=postgres://postgres:postgres@db:5432/htown
```

## Project Structure
```
/client  - Phaser + Vite client
/server  - Colyseus server + auth + DB
/shared  - shared schema, RNG, and data JSON
/assets  - attribution for optional art downloads
```
