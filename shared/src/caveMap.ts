export type CavePoint = {
  x: number;
  y: number;
  radius?: number;
};

export const caveBaseRadius = 26;

export const cavePath: CavePoint[] = [
  { x: 0, y: 0, radius: 26 },
  { x: 70, y: 20, radius: 24 },
  { x: 130, y: -40, radius: 22 },
  { x: 95, y: -120, radius: 24 },
  { x: 10, y: -150, radius: 26 },
  { x: -90, y: -110, radius: 28 },
  { x: -140, y: -20, radius: 26 },
  { x: -80, y: 90, radius: 24 },
  { x: 10, y: 130, radius: 26 },
  { x: 90, y: 80, radius: 24 },
  { x: 0, y: 0, radius: 26 }
];

export type CaveSample = {
  x: number;
  y: number;
  radius: number;
  distance: number;
  tangentX: number;
  tangentY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function closestPointOnCave(px: number, py: number): CaveSample {
  let best = {
    x: cavePath[0].x,
    y: cavePath[0].y,
    radius: cavePath[0].radius ?? caveBaseRadius,
    distance: Number.POSITIVE_INFINITY,
    tangentX: 1,
    tangentY: 0
  };

  for (let i = 0; i < cavePath.length - 1; i += 1) {
    const a = cavePath[i];
    const b = cavePath[i + 1];
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx * vx + vy * vy || 1;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / lenSq, 0, 1);
    const cx = ax + vx * t;
    const cy = ay + vy * t;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);
    const r0 = a.radius ?? caveBaseRadius;
    const r1 = b.radius ?? caveBaseRadius;
    const radius = r0 + (r1 - r0) * t;
    if (dist < best.distance) {
      const tangentLen = Math.hypot(vx, vy) || 1;
      best = {
        x: cx,
        y: cy,
        radius,
        distance: dist,
        tangentX: vx / tangentLen,
        tangentY: vy / tangentLen
      };
    }
  }

  return best;
}

export function clampToCave(px: number, py: number, pz = 0, padding = 0) {
  const closest = closestPointOnCave(px, py);
  const allowed = Math.max(4, closest.radius - padding);
  const dx = px - closest.x;
  const dy = py - closest.y;
  const dz = pz;
  const dist = Math.hypot(dx, dy, dz) || 1;
  if (dist <= allowed) {
    return { x: px, y: py, z: pz, outside: false, ...closest, distance: dist };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;
  return {
    x: closest.x + nx * allowed,
    y: closest.y + ny * allowed,
    z: nz * allowed,
    outside: true,
    ...closest,
    distance: dist
  };
}
