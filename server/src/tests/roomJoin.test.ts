import http from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from 'colyseus.js';
import { GameRoom } from '../rooms/GameRoom';
import { signAccessToken } from '../auth';

async function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for condition');
}

describe('Colyseus room join', () => {
  let server: http.Server;
  let gameServer: Server;
  let port = 0;

  beforeAll(async () => {
    server = http.createServer();
    gameServer = new Server({
      transport: new WebSocketTransport({ server })
    });
    gameServer.define('game', GameRoom);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const address = server.address();
    if (address && typeof address === 'object') {
      port = address.port;
    }
  });

  afterAll(async () => {
    if (gameServer) {
      await gameServer.gracefullyShutdown(false);
    }
    if (server && server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it(
    'accepts 5 clients in solo mode and syncs ship/player counts',
    async () => {
      const rooms: Array<{ leave: (consented?: boolean) => Promise<void> | void }> = [];

      const hostClient = new Client(`ws://localhost:${port}`);
      const hostUserId = 'user-0';
      const hostToken = signAccessToken(hostUserId);
      const hostRoom = await hostClient.create('game', {
        accessToken: hostToken,
        userId: hostUserId,
        mode: 'solo'
      });
      rooms.push(hostRoom);

      const roomId = hostRoom.roomId;
      const joinPromises = Array.from({ length: 4 }).map(async (_, index) => {
        const client = new Client(`ws://localhost:${port}`);
        const userId = `user-${index + 1}`;
        const token = signAccessToken(userId);
        const room = await client.joinById(roomId, { accessToken: token, userId, mode: 'solo' });
        rooms.push(room);
      });

      await Promise.all(joinPromises);

      await waitFor(() => hostRoom.state.mode === 'solo', 3000);
      await waitFor(
        () => hostRoom.state.players.size === 5 && hostRoom.state.ships.size === 5,
        5000,
        50
      );

      expect(hostRoom.state.mode).toBe('solo');
      expect(hostRoom.state.players.size).toBe(5);
      expect(hostRoom.state.ships.size).toBe(5);

      await Promise.all(rooms.map((room) => room.leave()));
    },
    15000
  );
});
