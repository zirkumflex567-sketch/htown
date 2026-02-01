import { describe, expect, it, vi } from 'vitest';
import { ShipSystem } from '../systems/ShipSystem';
import { GameState } from '../rooms/schema/GameState';

describe('ShipSystem cave clamp', () => {
  it('clamps ship inside cave and applies wall damage', () => {
    const state = new GameState();
    state.ship.position.x = 500;
    state.ship.position.y = 500;
    const room = {
      state,
      inputs: new Map([['pilot', { seat: 'pilot', move: { x: 1, y: 0 } }]]),
      rng: () => 0.5,
      simulationTime: 1000,
      stabilizerUntil: 0,
      lastPilotMove: { x: 0, y: 0 },
      seatBonuses: { pilot: { speed: 0 }, gunner: { damage: 0 }, power: { shield: 0 }, systems: { cooldown: 0 }, support: { vision: 0 } },
      damageShip: vi.fn(),
      lastWallHit: 0
    };
    const system = new ShipSystem(room as never);
    system.update(0.1);
    expect(Math.hypot(state.ship.position.x, state.ship.position.y)).toBeLessThan(500);
    expect(room.damageShip).toHaveBeenCalled();
  });
});
