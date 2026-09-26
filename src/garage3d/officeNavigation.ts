// Presentation-only navigation. Bounded deterministic A*, with swept-edge collision checks.
// No engine state, random numbers, per-frame searches, or changes to player furniture.
export interface Point {
  x: number;
  z: number;
}
export interface Obstacle extends Point {
  r?: number;
  hx?: number;
  hz?: number;
  id?: string;
}
export const BODY_RADIUS = 0.27;
export function clearPoint(p: Point, obstacles: readonly Obstacle[], bound: number): boolean {
  return (
    Math.abs(p.x) <= bound &&
    Math.abs(p.z) <= bound &&
    obstacles.every((o) =>
      o.r !== undefined
        ? Math.hypot(p.x - o.x, p.z - o.z) >= o.r + BODY_RADIUS
        : Math.abs(p.x - o.x) >= (o.hx ?? 0) + BODY_RADIUS ||
          Math.abs(p.z - o.z) >= (o.hz ?? 0) + BODY_RADIUS,
    )
  );
}
export function clearSegment(
  a: Point,
  b: Point,
  obstacles: readonly Obstacle[],
  bound: number,
): boolean {
  if (!clearPoint(a, obstacles, bound) || !clearPoint(b, obstacles, bound)) return false;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  return obstacles.every((o) => {
    if (o.r !== undefined) {
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
      );
      return Math.hypot(a.x + t * dx - o.x, a.z + t * dz - o.z) >= o.r + BODY_RADIUS;
    }
    let lo = 0,
      hi = 1;
    for (const [v, d, c, h] of [
      [a.x, dx, o.x, (o.hx ?? 0) + BODY_RADIUS],
      [a.z, dz, o.z, (o.hz ?? 0) + BODY_RADIUS],
    ]) {
      if (Math.abs(d) < 1e-9) {
        if (Math.abs(v - c) >= h) return true;
      } else {
        const t1 = (c - h - v) / d,
          t2 = (c + h - v) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    return lo >= hi;
  });
}
/** null means unreachable: never substitute a straight line through a blocker. */
export function findOfficePath(
  start: Point,
  end: Point,
  obstacles: readonly Obstacle[],
  bound: number,
): Point[] | null {
  if (!clearPoint(start, obstacles, bound) || !clearPoint(end, obstacles, bound)) return null;
  if (clearSegment(start, end, obstacles, bound)) return [{ ...end }];
  const n = Math.ceil((2 * bound) / 0.24),
    step = (2 * bound) / n,
    count = (n + 1) * (n + 1);
  const point = (i: number): Point => ({
    x: -bound + (i % (n + 1)) * step,
    z: -bound + Math.floor(i / (n + 1)) * step,
  });
  const free = new Uint8Array(count);
  for (let i = 0; i < count; i++) free[i] = Number(clearPoint(point(i), obstacles, bound));
  const scores = new Float64Array(count).fill(Infinity),
    parent = new Int32Array(count).fill(-1),
    closed = new Uint8Array(count);
  const open = new Set<number>();
  // Connect to all nearby visible cells, avoiding an arbitrary nearest-cell dead end.
  for (let i = 0; i < count; i++) {
    const p = point(i),
      d = Math.hypot(p.x - start.x, p.z - start.z);
    if (free[i] && d < step * 2 && clearSegment(start, p, obstacles, bound)) {
      scores[i] = d;
      open.add(i);
    }
  }
  while (open.size) {
    let best = -1,
      cost = Infinity;
    for (const i of open) {
      const p = point(i),
        f = scores[i] + Math.hypot(p.x - end.x, p.z - end.z);
      if (f < cost) {
        cost = f;
        best = i;
      }
    }
    open.delete(best);
    closed[best] = 1;
    const p = point(best);
    if (Math.hypot(p.x - end.x, p.z - end.z) < step * 2 && clearSegment(p, end, obstacles, bound)) {
      const raw: Point[] = [{ ...end }];
      let at = best;
      while (at !== -1) {
        raw.push(point(at));
        at = parent[at];
      }
      raw.push({ ...start });
      raw.reverse();
      const smooth: Point[] = [];
      let anchor = 0;
      while (anchor < raw.length - 1) {
        let next = raw.length - 1;
        while (next > anchor + 1 && !clearSegment(raw[anchor], raw[next], obstacles, bound)) next--;
        smooth.push(raw[next]);
        anchor = next;
      }
      return smooth;
    }
    const col = best % (n + 1),
      row = Math.floor(best / (n + 1));
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = col + dx,
          z = row + dz;
        if (x < 0 || z < 0 || x > n || z > n) continue;
        const j = z * (n + 1) + x;
        if (!free[j] || closed[j]) continue;
        const q = point(j);
        const g = scores[best] + Math.hypot(q.x - p.x, q.z - p.z);
        if (g < scores[j] && clearSegment(p, q, obstacles, bound)) {
          scores[j] = g;
          parent[j] = best;
          open.add(j);
        }
      }
  }
  return null;
}
