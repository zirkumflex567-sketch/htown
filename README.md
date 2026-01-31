# H-Town Co-op Prototype

A playable browser/mobile-first co-op roguelite prototype with shared-seat gameplay, seat swaps, bots, and an authoritative Colyseus server.

## Requirements

- Node.js 18+
- npm 9+

## Getting started

```bash
npm install
```

### Development (client + server)

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:2567

### Build

```bash
npm run build
```

### Tests

```bash
npm test
```

## Docker

```bash
docker-compose up --build
```

This runs the server with a persisted SQLite volume. The client is served separately during dev.

## How to play

1. Open the client in a browser.
2. Register/login.
3. Join a room (optional room code) or quick play.
4. Use your assigned station:
   - **Pilot**: WASD + Space for boost.
   - **Gunner**: Aim with mouse, Space to fire.
   - **Power**: adjust sliders.
   - **Systems**: hold Overdrive.
   - **Support**: hold Repair/Ping/Loot Pulse.

Seat swaps trigger at random intervals with a warning banner.

## Project structure

- `/client` Phaser + Vite front-end
- `/server` Colyseus + Express back-end
- `/shared` shared data and deterministic RNG

## Notes

- Assets are rendered with simple vector shapes in code. See `client/public/assets/THIRD_PARTY.md` for placeholders and future attribution.
