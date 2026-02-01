import { describe, expect, it, vi } from 'vitest';
import { ShipSystem } from '../systems/ShipSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { GameState } from '../rooms/schema/GameState';

describe('Balance checks', () => {
  it('clamps ship speed to boost limit', () => {
    const state = new GameState();
    state.ship.energyEngines = 1;
    state.ship.energyWeapons = 0;
    state.ship.energyShields = 0;
    state.ship.powerTargetEngines = 1;
    state.ship.powerTargetWeapons = 0;
    state.ship.powerTargetShields = 0;
    state.ship.velocity.x = 200;
    state.ship.velocity.y = 0;
    const room = {
      state,
      inputs: new Map([['pilot', { seat: 'pilot', move: { x: 0, y: 0 }, boost: true }]]),
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
    const speed = Math.hypot(state.ship.velocity.x, state.ship.velocity.y, state.ship.velocity.z);
    expect(speed).toBeLessThanOrEqual(122);
  });

  it('spawns a boss on every 5th wave cadence', () => {
    const room = {
      state: new GameState(),
      rng: () => 0.5,
      simulationTime: 0,
      damageReduction: 1,
      spawnProjectile: vi.fn()
    };
    room.state.wave = 5;
    const system = new EnemySystem(room as never);
    system.spawnWave();
    expect(room.state.wave).toBe(6);
    const hasBoss = room.state.enemies.some((enemy) => enemy.kind.startsWith('boss-'));
    expect(hasBoss).toBe(true);
  });

  it('does not spawn a boss off cadence', () => {
    const room = {
      state: new GameState(),
      rng: () => 0.5,
      simulationTime: 0,
      damageReduction: 1,
      spawnProjectile: vi.fn()
    };
    room.state.wave = 4;
    const system = new EnemySystem(room as never);
    system.spawnWave();
    const hasBoss = room.state.enemies.some((enemy) => enemy.kind.startsWith('boss-'));
    expect(hasBoss).toBe(false);
  });
});
