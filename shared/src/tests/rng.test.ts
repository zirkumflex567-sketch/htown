import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../utils/rng';

describe('mulberry32', () => {
  it('produces deterministic sequence', () => {
    const rngA = mulberry32(1234);
    const rngB = mulberry32(1234);
    const a = [rngA(), rngA(), rngA()];
    const b = [rngB(), rngB(), rngB()];
    expect(a).toEqual(b);
  });
});
