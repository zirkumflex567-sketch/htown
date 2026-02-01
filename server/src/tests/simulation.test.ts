import { describe, expect, it } from 'vitest';
import { ShipSystem } from '../systems/ShipSystem';
import { GameState } from '../rooms/schema/GameState';

const makeRoom = () => ({
  state: new GameState(),
  inputs: new Map([['pilot', { seat: 'pilot', move: { x: 1, y: 0 } }]]),
  rng: () => 0.5
});

describe('ShipSystem', () => {
  it('updates ship position based on pilot input', () => {
    const room = makeRoom();
    const shipSystem = new ShipSystem(room as never);
    shipSystem.update(0.5);
    expect(room.state.ship.position.x).toBeGreaterThan(0);
  });
});
