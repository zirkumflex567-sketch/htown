import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSim } from '../src/sim/game.js';

test('GameSim advances time and spawns enemies', () => {
  const sim = new GameSim(123);
  const start = sim.time;
  sim.tick(0.05, {});
  sim.tick(0.05, {});
  assert.ok(sim.time > start);
  for (let i = 0; i < 100; i += 1) {
    sim.tick(0.05, {});
  }
  assert.ok(sim.enemies.length > 0);
});
