import { FLOOR } from "../engine/factoryFloor.ts";

// The factory's surroundings (handoff gap F7): a fenced loading yard on the dock side with parking
// lines and lamp posts, and a row of trees behind the back wall. Everything sits inside the camera
// fit's box (factoryFraming.ts), so no piece is ever cut off at a frame edge. Pure presentation, derived from the
// floor width alone (no RNG, no engine reads), so a given factory always has the same yard.

export interface YardLayout {
  posts: [number, number][];
  rails: { x: number; z: number; len: number; yaw: number }[];
  lamps: [number, number][];
  parking: [number, number][];
  trees: { x: number; z: number; s: number }[];
}

const idHash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Pure layout of the building's surroundings, in world units. West (the dock side) is fixed; the
 *  tree row behind the back wall spreads along the building as floor expansions grow it east. Kept
 *  clear of the dock apron + truck (z 1..4), the AGV lanes (x -12.5..-9.1, z -2..3.7), the expansion
 *  bays (east, inside the walls' z range) and the camera side (south), so it never hides the floor. */
export function yardLayout(floorW: number): YardLayout {
  const FENCE_X = -14.0, YARD_NORTH = -6.2, YARD_SOUTH = 5.8, GATE: [number, number] = [0.8, 4.2];
  const posts: [number, number][] = [];
  for (let z = YARD_NORTH; z <= YARD_SOUTH + 1e-6; z += 1.0) if (z < GATE[0] || z > GATE[1]) posts.push([FENCE_X, z]);
  for (let x = FENCE_X + 1.0; x <= -8.6 + 1e-6; x += 1.0) posts.push([x, YARD_NORTH]);
  // rails join consecutive posts on the same line (never across the gate)
  const rails: { x: number; z: number; len: number; yaw: number }[] = [];
  const west = posts.filter(([x]) => x === FENCE_X).sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < west.length; i++) {
    const [, z0] = west[i - 1], [, z1] = west[i];
    if (z1 - z0 < 1.5) rails.push({ x: FENCE_X, z: (z0 + z1) / 2, len: z1 - z0, yaw: 0 });
  }
  const north = posts.filter(([, z]) => z === YARD_NORTH).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < north.length; i++) {
    const [x0] = north[i - 1], [x1] = north[i];
    rails.push({ x: (x0 + x1) / 2, z: YARD_NORTH, len: x1 - x0, yaw: Math.PI / 2 });
  }
  const lamps: [number, number][] = [[-13.6, -5.7], [-13.6, 5.4], [-9.1, 5.7]];
  const parking: [number, number][] = [-13.2, -12.0, -10.8, -9.6].map((x) => [x, -4.5]);
  // trees: a row behind the back wall (z ≈ -7) along the building. None on the west: in portrait
  // the dock side is the foreground, and the framing (factoryFraming.ts WEST) ends at the fence.
  const x0 = -FLOOR.w / 2, span = floorW;
  const row = Math.max(3, Math.round(span / 4.5));
  const trees: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < row; i++) {
    const h = idHash(`tree${i}`);
    trees.push({ x: x0 + (i + 0.5) * (span / row) + ((h % 100) / 100 - 0.5) * 0.8, z: -7.0 - ((h >> 7) % 100) / 100 * 0.6, s: 0.8 + ((h >> 13) % 100) / 100 * 0.35 });
  }
  return { posts, rails, lamps, parking, trees };
}
