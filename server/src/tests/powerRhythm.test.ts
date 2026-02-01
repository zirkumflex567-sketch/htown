import { describe, expect, it, vi } from 'vitest';
import { ShipSystem } from '../systems/ShipSystem';
import { GameState } from '../rooms/schema/GameState';

describe('Power rhythm', () => {
  it('opens a timing window on major shift and rewards a follow-up', () => {
    const state = new GameState();
    const room = {
      state,
      inputs: new Map(),
      rng: () => 0.5,
      simulationTime: 0,
      stabilizerUntil: 0,
      lastPilotMove: { x: 0, y: 0 },
      seatBonuses: { pilot: { speed: 0 }, gunner: { damage: 0 }, power: { shield: 0 }, systems: { cooldown: 0 }, support: { vision: 0 } },
      damageShip: vi.fn(),
      lastWallHit: 0
    };
    const system = new ShipSystem(room as never);

    room.inputs.set('power', { seat: 'power', powerPreset: 'attack' });
    system.update(0.1);
    expect(state.ship.powerWindowEnd).toBeGreaterThan(0);

    const windowStart = state.ship.powerWindowStart;
    room.simulationTime = Math.floor((windowStart + 0.15) * 1000);
    room.inputs.set('power', { seat: 'power', powerPreset: 'speed' });
    system.update(0.1);
    expect(state.ship.powerPerfectUntil).toBeGreaterThan(windowStart);
  });
});
