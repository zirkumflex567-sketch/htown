import { describe, expect, it } from 'vitest';
import { SeatSystem } from '../systems/SeatSystem';
import { GameState, PlayerState } from '../rooms/schema/GameState';

const makeRoom = () => ({
  state: new GameState(),
  rng: () => 0.42,
  simulationTime: 0,
  damageReduction: 1,
  swapGraceUntil: 0,
  swapOverdriveSeconds: 0,
  enableSeatStabilizer: () => {},
  refreshBots: () => {}
});

describe('SeatSystem', () => {
  it('swaps a single human to a different seat', () => {
    const room = makeRoom();
    const player = new PlayerState();
    player.id = 'p1';
    player.seat = 'pilot';
    room.state.players.set(player.id, player);
    const system = new SeatSystem(room as never);
    (system as any).performSwap();
    expect(player.seat).not.toBe('pilot');
  });
});
