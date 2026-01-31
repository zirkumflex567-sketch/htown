import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicRng } from '../src/rng.js';

test('DeterministicRng is deterministic for same seed', () => {
  const rngA = new DeterministicRng(42);
  const rngB = new DeterministicRng(42);
  const valuesA = Array.from({ length: 5 }, () => rngA.next());
  const valuesB = Array.from({ length: 5 }, () => rngB.next());
  assert.deepEqual(valuesA, valuesB);
});

test('DeterministicRng returns values between 0 and 1', () => {
  const rng = new DeterministicRng(7);
  const value = rng.next();
  assert.ok(value >= 0 && value <= 1);
});
