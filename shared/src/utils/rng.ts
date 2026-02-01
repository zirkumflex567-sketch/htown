export function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng: () => number, min: number, max: number) {
  return rng() * (max - min) + min;
}

export function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(randomRange(rng, min, max + 1));
}
