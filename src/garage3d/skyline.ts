// Exterior scenery for the dark garage diorama. The buildings sit BEHIND the dollhouse walls, so
// they are only seen when a wall is culled while the camera orbits (see `useWallCull`).
//
// These live in the ROOM's x/z space, which the facility tier scales (`roomScaleFor`). So the
// buildings' POSITIONS scale with the room — but their GEOMETRY must not: a distant tower does not
// grow when the office gets bigger. Scaling both (the earlier bug, by leaving the positions
// unscaled) either buries the scenery inside a larger room or inflates it if the mesh group is
// scaled. Pure data + a placement helper so the tier bounds are unit-tested (skyline.test.ts).

export interface SkylineBuilding {
  /** Centre along the wall's tangent axis, in garage-scale world units (x for wall A, z for wall B). */
  at: number;
  /** Building height in metres (never scaled — see the module note). */
  h: number;
}

/** Row outside wall B (−x), tangent = z, seen past the left wall. */
export const SKYLINE_WALL_B: readonly SkylineBuilding[] = [
  { at: -1.8, h: 2.6 },
  { at: -0.9, h: 4.0 },
  { at: 0.0, h: 2.0 },
  { at: 0.9, h: 3.2 },
];

/** Row outside wall A (−z), tangent = x, seen past the back wall. */
export const SKYLINE_WALL_A: readonly SkylineBuilding[] = [
  { at: -1.6, h: 3.0 },
  { at: 0.2, h: 4.4 },
  { at: 1.8, h: 2.4 },
  { at: 3.0, h: 3.6 },
];

/** Distance from the room centre to each exterior row at garage scale. Sits 1.1m proud of the
 *  ±4.2 base wall, which is the clearance the row keeps at every tier (positions scale together). */
export const SKYLINE_WALL_B_X = -5.3;
export const SKYLINE_WALL_A_Z = -5.3;

/** The room's half-extent at garage scale, matching the ±4.2 walls in room.tsx. */
export const ROOM_HALF_BASE = 4.2;

/** Silhouette tone for the distant blocks — a desaturated night blue, outside the furniture palette. */
export const SKYLINE_COLOR = "#2a3550";

/** Half the box's depth toward the room, per row (wall B is thin in x, wall A thin in z). */
export const SKYLINE_HALF_DEPTH = 0.35;

export interface SkylinePiece {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
}

/** Build the exterior rows for a room scale. Meshes keep their authored size; only x/z POSITIONS
 *  scale, so the scenery stays outside the grown walls without growing itself. */
export function skylinePlacement(roomK: number): { wallB: SkylinePiece[]; wallA: SkylinePiece[] } {
  return {
    wallB: SKYLINE_WALL_B.map((b, i) => ({
      key: `bx${i}`,
      position: [SKYLINE_WALL_B_X * roomK, b.h / 2, b.at * roomK],
      size: [0.7, b.h, 0.9],
    })),
    wallA: SKYLINE_WALL_A.map((b, i) => ({
      key: `bz${i}`,
      position: [b.at * roomK, b.h / 2, SKYLINE_WALL_A_Z * roomK],
      size: [0.9, b.h, 0.7],
    })),
  };
}
