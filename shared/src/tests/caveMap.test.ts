import { describe, expect, it } from 'vitest';
import { caveBaseRadius, cavePath, clampToCave, closestPointOnCave } from '../caveMap';

describe('caveMap', () => {
  it('returns zero distance when point lies on the path', () => {
    const point = cavePath[0];
    const sample = closestPointOnCave(point.x, point.y);
    expect(sample.distance).toBeLessThan(0.001);
  });

  it('clamps far away point back into the cave', () => {
    const sample = clampToCave(1000, 1000, 0);
    expect(sample.outside).toBe(true);
    expect(sample.distance).toBeGreaterThan(0);
    expect(sample.radius).toBeGreaterThan(0);
  });

  it('keeps inside point untouched', () => {
    const mid = cavePath[1];
    const sample = closestPointOnCave(mid.x, mid.y);
    const nx = -sample.tangentY;
    const ny = sample.tangentX;
    const offset = Math.min(1, sample.radius * 0.3);
    const inside = clampToCave(sample.x + nx * offset, sample.y + ny * offset, 0);
    expect(inside.outside).toBe(false);
    expect(inside.distance).toBeLessThan(sample.radius);
  });

  it('radius interpolates between control points', () => {
    const a = cavePath[0];
    const b = cavePath[1];
    const mid = clampToCave((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 0);
    expect(mid.radius).toBeGreaterThan(0);
    expect(mid.radius).toBeLessThanOrEqual(Math.max(a.radius ?? caveBaseRadius, b.radius ?? caveBaseRadius));
  });
});
