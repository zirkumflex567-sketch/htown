import { describe, expect, it, vi } from 'vitest';
import { EnemySystem } from '../systems/EnemySystem';
import { GameState, EnemyState } from '../rooms/schema/GameState';

const makeRoom = () => {
  const state = new GameState();
  return {
    state,
    rng: () => 0.5,
    simulationTime: 0,
    damageReduction: 1,
    spawnProjectile: vi.fn(),
    maybeDropUpgrade: vi.fn(),
    killCount: 0,
    bossKillCount: 0,
    getEnemyTargets: () => [{ id: 'crew', ship: state.ship }],
    getSpawnAnchor: () => ({
      x: state.ship.position.x,
      y: state.ship.position.y,
      z: state.ship.position.z
    })
  };
};

describe('EnemySystem', () => {
  it('spitter fires projectiles when in range', () => {
    const room = makeRoom();
    room.simulationTime = 2000;
    room.state.ship.position.x = 0;
    room.state.ship.position.y = 0;
    room.state.ship.position.z = 0;
    const enemy = new EnemyState();
    enemy.id = 'spitter-1';
    enemy.kind = 'spitter';
    enemy.health = 10;
    enemy.position.x = 40;
    enemy.position.y = 0;
    enemy.position.z = 0;
    room.state.enemies.push(enemy);
    const system = new EnemySystem(room as never);
    system.update(0.1);
    expect(room.spawnProjectile).toHaveBeenCalled();
  });

  it('boss triggers a burst volley after telegraph', () => {
    const room = makeRoom();
    room.simulationTime = 2000;
    room.state.ship.position.x = 0;
    room.state.ship.position.y = 0;
    room.state.ship.position.z = 0;
    const boss = new EnemyState();
    boss.id = 'boss-1';
    boss.kind = 'boss-warden';
    boss.health = 100;
    boss.position.x = 60;
    boss.position.y = 0;
    boss.position.z = 0;
    room.state.enemies.push(boss);
    const system = new EnemySystem(room as never);
    system.update(0.1);
    expect(boss.telegraphUntil).toBeGreaterThan(0);
    room.simulationTime += 1500;
    system.update(0.1);
    expect(room.spawnProjectile).toHaveBeenCalled();
  });

  it('spawns enemies near the ship (ring)', () => {
    const room = makeRoom();
    room.state.ship.position.x = 120;
    room.state.ship.position.y = -80;
    room.state.ship.position.z = 0;
    const system = new EnemySystem(room as never);
    system.spawnWave();
    expect(room.state.enemies.length).toBeGreaterThan(0);
    const tooFar = room.state.enemies.some((enemy) => {
      const dx = enemy.position.x - room.state.ship.position.x;
      const dy = enemy.position.y - room.state.ship.position.y;
      const dz = enemy.position.z - room.state.ship.position.z;
      const dist = Math.hypot(dx, dy, dz);
      return dist > 220;
    });
    expect(tooFar).toBe(false);
  });

  it('applies poison damage over time', () => {
    const room = makeRoom();
    room.simulationTime = 1000;
    room.state.ship.position.x = 0;
    room.state.ship.position.y = 0;
    room.state.ship.position.z = 0;
    const enemy = new EnemyState();
    enemy.id = 'poison-1';
    enemy.kind = 'chaser';
    enemy.health = 10;
    enemy.position.x = 20;
    enemy.position.y = 0;
    enemy.position.z = 0;
    enemy.poisonedUntil = room.simulationTime / 1000 + 2;
    room.state.enemies.push(enemy);
    const system = new EnemySystem(room as never);
    system.update(0.5);
    expect(enemy.health).toBeLessThan(10);
  });
});
