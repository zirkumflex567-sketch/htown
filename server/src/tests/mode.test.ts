import { describe, expect, it } from 'vitest';
import { GameRoom } from '../rooms/GameRoom';

describe('GameRoom mode selection', () => {
  it('locks single mode to one client', () => {
    const room = new GameRoom();
    room.onCreate({ mode: 'single' });
    expect(room.mode).toBe('single');
    expect(room.maxClients).toBe(1);
  });

  it('locks solo mode to five clients', () => {
    const room = new GameRoom();
    room.onCreate({ mode: 'solo' });
    expect(room.mode).toBe('solo');
    expect(room.maxClients).toBe(5);
  });

  it('defaults crew mode to five clients', () => {
    const room = new GameRoom();
    room.onCreate();
    expect(room.mode).toBe('crew');
    expect(room.maxClients).toBe(5);
  });
});
