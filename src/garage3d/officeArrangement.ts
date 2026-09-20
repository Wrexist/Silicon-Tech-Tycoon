// Smart arrangement for the 3D office — presentation-only, pure, unit-testable in Node.
//
// Two concerns live here, both deterministic and neither one touching `state.layout`:
//
// 1. `derivedYawFor` — the render-time ORIENTATION rules. Facing is computed from a piece's
//    neighbours, never authored: a chair reads the desk/table it stands beside, a lounge seat reads
//    its rug/coffee table, a wall-backed unit reads the wall it touches. Only quarter turns that
//    preserve the stored footprint are considered (a 2x1 sofa can never be derived into a 1x2 that
//    overlaps its neighbour). A saved room renders as its owner placed it except where one of these
//    relationships makes a correctly-placed piece read better.
//
//    The conventions, in priority order:
//      • wall-backed pieces (storage / tech / arcade / closed fronts) at a grid edge lie flat to
//        that wall: r=0 → face +z, c=0 → face +x, c+w=n → face −x.
//      • a seat (chair / lounge seating) faces the nearest adjacent WORK surface (a desk or table);
//        if there is none, the nearest adjacent lounge focal (rug / coffee table / TV).
//      • everything else keeps the rotation its owner gave it.
//
// 2. `arrangeOffice` — the GAME-OWNED DRESSING plan. Given the facility tier and headcount it lays
//    out the room's zone furniture (work desks, a lounge, a research/storage run, a culture accent)
//    around the player's own furniture. The player's layout is immovable INPUT: every piece in it is
//    an obstacle, and a zone the player has already furnished is left exactly as they arranged it.
//    The room shell's fixed fixtures (vault, coffee station, printer, plants, easel, test chamber)
//    are reserved cells, mirrored from the world positions the Scene renders.
//
// Determinism: no Math.random, no clock. The few free choices (which row the culture accent lands
// on) come from a derived cosmetic hash of (seed, week, era) — salt 467, registered in CLAUDE.md.
// The engine never reads any of this, so the pinned sim cannot see it.

import {
  canPlace,
  furnitureDef,
  footprint,
  gridN,
  gridOrigin,
  GRID,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { cosmeticHash01 } from "./officeLive.ts";
import { stationKey, workstationModuleFor, type WorkstationModule } from "./workstationModule.ts";

/** Cosmetic stream for the arrangement's free choices (see CLAUDE.md's salt registry). */
const ARRANGEMENT_SALT = 467;

// ---- Orientation rules -------------------------------------------------------------------------

/** Quarter-turn angles indexed by rot. */
const YAW: readonly number[] = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

/** A seat reads these first: a chair beside a desk or table is for working there. */
const WORK_TARGETS: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "desk", "deskL", "standingDesk", "dualDesk", "executiveDesk", "meetingTable", "roundTable",
]);

/** Failing a work surface, lounge seating reads the group it is part of. */
const LOUNGE_TARGETS: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "rug", "rugRound", "coffeeTable", "sideTable", "tvStand", "zenFountain",
]);

/** Seating with a front and a back. Radial pieces (stool, beanbag) are deliberately absent. */
const FACING_SEATS: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "chair", "armchair", "loungeChair", "gamingChair", "sofa", "sofaL", "bench", "napPod",
]);

/** Pieces authored with a front flat against a wall (shelf fronts, screens, cabinets). Greenery,
 *  rugs and radial pieces have no wall relationship to derive. */
const WALL_PIECES: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "bookshelf", "cabinet", "lockers", "filingCabinet", "shelfUnit", "wardrobe", "trophyCase",
  "tvStand", "ideaWall", "serverRack", "printer", "superCluster", "quantumRig", "arcade", "vending",
]);

interface CellRect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

function rectOf(item: PlacedItem): CellRect {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  return { c0: item.c, r0: item.r, c1: item.c + w - 1, r1: item.r + d - 1 };
}

function rectsTouch(a: CellRect, b: CellRect): boolean {
  return a.c0 <= b.c1 + 1 && b.c0 <= a.c1 + 1 && a.r0 <= b.r1 + 1 && b.r0 <= a.r1 + 1;
}

const centreOf = (item: PlacedItem): { x: number; z: number } => {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  return { x: item.c + w / 2, z: item.r + d / 2 };
};

/** The quarter turns that keep the stored footprint: any turn of a square piece, a half turn
 *  otherwise. A derived 90° on a 2x1 piece would change which cells it covers. */
function safeYaws(item: PlacedItem): number[] {
  const def = furnitureDef(item.type);
  if (def.w === def.d) return YAW.slice();
  return [YAW[item.rot % 2], YAW[item.rot % 2 + 2]];
}

const snapYaw = (from: { x: number; z: number }, to: { x: number; z: number }): number => {
  const a = Math.atan2(to.x - from.x, to.z - from.z);
  return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4 * (Math.PI / 2);
};

/** Which wall a wall-backed piece touches, if any. The front edge (+z) is open in the diorama, but
 *  a piece there still reads as facing into the room, so it faces −z. A piece in a corner touches
 *  two edges at once — genuinely ambiguous — so it keeps the rotation its owner gave it. */
function wallYawOf(item: PlacedItem, facilityTier: number): number | null {
  const n = gridN(facilityTier);
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  const edges = [
    item.r === 0 ? YAW[0] : null,       // back wall → +z
    item.c === 0 ? YAW[1] : null,       // left wall → +x
    item.c + w === n ? YAW[3] : null,   // right wall → −x
    item.r + d === n ? YAW[2] : null,   // open front edge → −z, into the room
  ].filter((yaw): yaw is number => yaw != null);
  return edges.length === 1 ? edges[0] : null;
}

/**
 * The world-space yaw a piece should RENDER with, in the same convention as `worldOf`
 * (`item.rot * PI/2`). Pure; reads the layout but never writes it.
 */
export function derivedYawFor(item: PlacedItem, layout: readonly PlacedItem[], facilityTier = 1): number {
  const allowed = safeYaws(item);

  if (WALL_PIECES.has(item.type)) {
    const yaw = wallYawOf(item, facilityTier);
    if (yaw != null && allowed.includes(yaw)) return yaw;
  }

  if (FACING_SEATS.has(item.type)) {
    const self = rectOf(item);
    const adjacent = layout.filter((it) => it.iid !== item.iid && rectsTouch(self, rectOf(it)));
    const centre = centreOf(item);
    const nearest = (candidates: PlacedItem[]): PlacedItem | null =>
      candidates.reduce<PlacedItem | null>((best, it) => {
        if (!best) return it;
        const a = centreOf(it), b = centreOf(best);
        const da = (a.x - centre.x) ** 2 + (a.z - centre.z) ** 2;
        const db = (b.x - centre.x) ** 2 + (b.z - centre.z) ** 2;
        return da < db ? it : best;
      }, null);
    const work = nearest(adjacent.filter((it) => WORK_TARGETS.has(it.type)));
    const focal = work ?? nearest(adjacent.filter((it) => LOUNGE_TARGETS.has(it.type)));
    if (focal) {
      const yaw = snapYaw(centre, centreOf(focal));
      if (allowed.includes(yaw)) return yaw;
    }
  }

  return YAW[item.rot];
}

/** `derivedYawFor`'s result as the store-able quarter turn the staging script writes. */
export function rotForYaw(yaw: number): Rot {
  return (((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4) as Rot;
}

// ---- Fixed architecture (cells the dressing may never use) -------------------------------------

/** The live room-shell dressing, so reservations mirror what the Scene actually renders. A fixture
 *  the player has not unlocked (or the theme does not draw) must not eat arranger cells. */
export interface FixtureOptions {
  /** Dark theme draws the garage clutter + tool chest; the light diorama does not. */
  dark?: boolean;
  /** Amenities upgrade tier: 1 counter + nook rug, 2/3/4 add a plant each. */
  amenities?: number;
  designSuite?: boolean;
  testLab?: boolean;
}

/** Conservative default: reserve every fixture, so a caller that forgets an option can only lose
 *  cells, never overlap. */
const ALL_FIXTURES: Required<FixtureOptions> = { dark: true, amenities: 4, designSuite: true, testLab: true };

/** World position + footprint (metres, roomScale 1) of the room shell's own fixtures. Mirrors the
 *  positions `Garage3D.tsx` renders: Vault, CoffeeStation (counter + nook rug), Printer, Props
 *  plant, the amenities plants, DesignEasel, TestChamber and the dark theme's garage clutter.
 *  The arrival of an upgrade that moves one of these must move it here too. */
const FIXTURES: readonly ({ x: number; z: number; w: number; d: number } & { when?: (o: Required<FixtureOptions>) => boolean })[] = [
  { x: -3.5, z: 1.6, w: 1.0, d: 0.7 },                                                     // vault
  { x: -3.0, z: 2.9, w: 1.0, d: 1.0 },                                                     // printer
  { x: 3.1, z: 3.0, w: 0.8, d: 0.8 },                                                      // front-right shell plant
  { x: -3.6, z: 0.5, w: 1.0, d: 0.6, when: (o) => o.amenities >= 1 },                      // coffee counter
  { x: -2.9, z: 0.62, w: 2.1, d: 1.5, when: (o) => o.amenities >= 1 },                     // coffee nook rug
  { x: -3.3, z: 3.1, w: 0.9, d: 0.9, when: (o) => o.amenities >= 2 },                      // amenities plant (tier 2)
  { x: 3.4, z: 1.4, w: 0.8, d: 0.8, when: (o) => o.amenities >= 3 },                       // amenities plant (tier 3)
  { x: 3.5, z: 0.0, w: 0.8, d: 0.8, when: (o) => o.amenities >= 4 },                       // amenities plant (tier 4)
  { x: 3.5, z: 0.9, w: 1.1, d: 0.9, when: (o) => o.designSuite },                          // design easel
  { x: 3.6, z: -1.5, w: 1.0, d: 0.8, when: (o) => o.testLab },                             // test chamber
  { x: -3.2, z: -3.0, w: 1.0, d: 1.0, when: (o) => o.dark },                               // garage clutter (left)
  { x: 3.1, z: -3.0, w: 1.1, d: 0.9, when: (o) => o.dark },                                // tool chest + ball bin (right)
];

// ---- Negative space: the circulation lane and the density caps ----------------------------------
// A room reads as designed when it is not full. Two budgets enforce that:
//
//   1. The LANE. One full row across the middle of the room is kept empty. Row 5 is the row nearest
//      the centre that is never a desk row (1, 4, 7, …) or one of their chair bands (0, 3, 6, …) at
//      any tier, so an avenue always crosses the room between two desk banks. Every game-owned
//      piece — desks included — has to keep out of it; a piece that would land there skips instead.
//   2. The CAPS. Per-zone and per-tier limits on game-owned DRESSING (work desks are seating, not
//      dressing; headcount governs them). Fewer, better pieces: the lounge budget buys a rug, a
//      seat, a table and a lamp, not a rug plus every chair, plant and lamp that fits.

/** The cells of the central circulation lane at a tier. */
export function circulationLane(facilityTier: number): { c: number; r: number }[] {
  const n = gridN(Math.max(1, Math.floor(facilityTier)));
  const row = 5;
  return Array.from({ length: n }, (_, c) => ({ c, r: row }));
}

/** The lane as solid obstacles, so the same `canPlace` maths that guards fixtures guards it too. */
export function laneObstacles(facilityTier: number): PlacedItem[] {
  return circulationLane(facilityTier).map(({ c, r }, i) => ({ iid: `lane${i}`, type: "crates" as const, c, r, rot: 0 as const }));
}

/** Max game-owned dressing pieces per zone, indexed by facility tier (tier 1 = garage: none). */
const DRESSING_CAP: Record<Exclude<ArrangementZone, "work">, readonly number[]> = {
  lounge: [0, 0, 4, 4],
  storage: [0, 0, 2, 3],
  culture: [0, 0, 1, 1],
};
/** Max game-owned dressing pieces in the whole room, indexed by facility tier. */
const DRESSING_TOTAL_CAP = [0, 0, 7, 8];

const tierIndex = (facilityTier: number) => Math.max(0, Math.min(3, Math.floor(facilityTier)));

export function dressingCap(zone: Exclude<ArrangementZone, "work">, facilityTier: number): number {
  return DRESSING_CAP[zone][tierIndex(facilityTier)];
}

export function dressingTotalCap(facilityTier: number): number {
  return DRESSING_TOTAL_CAP[tierIndex(facilityTier)];
}

function cellsInRect(
  x0: number, x1: number, z0: number, z1: number, origin: number, cellSize: number, n: number,
): { c: number; r: number }[] {
  const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
  const c0 = clamp(Math.floor((x0 - origin) / cellSize));
  const c1 = clamp(Math.ceil((x1 - origin) / cellSize) - 1);
  const r0 = clamp(Math.floor((z0 - origin) / cellSize));
  const r1 = clamp(Math.ceil((z1 - origin) / cellSize) - 1);
  const out: { c: number; r: number }[] = [];
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) out.push({ c, r });
  return out;
}

/** The fixed-fixture cells for a tier, as solid 1x1 obstacles the placement maths understands. The
 *  scene scales its fixtures with the room, so their cells move with the tier; fixtures overlap each
 *  other (the coffee counter stands on its nook rug), so cells are de-duplicated. */
export function fixtureObstacles(facilityTier: number, opts: FixtureOptions = {}): PlacedItem[] {
  const o: Required<FixtureOptions> = {
    dark: opts.dark ?? ALL_FIXTURES.dark,
    amenities: opts.amenities ?? ALL_FIXTURES.amenities,
    designSuite: opts.designSuite ?? ALL_FIXTURES.designSuite,
    testLab: opts.testLab ?? ALL_FIXTURES.testLab,
  };
  const tier = Math.max(1, Math.floor(facilityTier));
  const n = gridN(tier);
  const k = n / GRID.n;
  const origin = gridOrigin(tier);
  const cells = new Set<string>();
  for (const f of FIXTURES) {
    if (f.when && !f.when(o)) continue;
    for (const { c, r } of cellsInRect((f.x - f.w / 2) * k, (f.x + f.w / 2) * k, (f.z - f.d / 2) * k, (f.z + f.d / 2) * k, origin, GRID.cell, n)) {
      cells.add(`${c},${r}`);
    }
  }
  return [...cells].map((cell, i) => {
    const [c, r] = cell.split(",").map(Number);
    return { iid: `fx${i}`, type: "crates" as const, c, r, rot: 0 as const };
  });
}

// ---- The arranger ------------------------------------------------------------------------------

export type ArrangementZone = "work" | "lounge" | "storage" | "culture";

export interface ArrangedPiece extends PlacedItem {
  zone: ArrangementZone;
  /** Work pieces only: the workstation module (screen layout + prop) the unit was authored with.
   *  The chair is the engine's derived seat, so it is never a grid item — see workstationModule.ts. */
  module?: WorkstationModule;
}

export interface ArrangeInput {
  /** 1 garage / 2 studio / 3 campus. */
  facilityTier: number;
  /** How many desks (one employee each) the work zone must seat. */
  headcount: number;
  /** The player's placed furniture — immovable input, never moved or copied back out. */
  occupied?: readonly PlacedItem[];
  /** Cosmetic only; folded into the arrangement's derived-hash stream. */
  era?: number;
  seed?: number;
  week?: number;
  /** The room shell's live dressing — the scene passes what it actually renders. */
  dark?: boolean;
  amenities?: number;
  designSuite?: boolean;
  testLab?: boolean;
  /** The computers upgrade's panel budget per desk (1 or 2) — the module's screen cap. */
  monitors?: number;
}

export interface Arrangement {
  facilityTier: number;
  /** Work + dressing, in placement order. The staging script writes these to a layout; the scene
   *  renders only `dressing`. */
  pieces: ArrangedPiece[];
  /** Lounge / storage / culture pieces — the game-owned dressing. */
  dressing: ArrangedPiece[];
  /** Desks actually placed for the headcount. */
  seats: number;
}

/** Rows reserved for desks — every third row from the back, so each desk bank keeps a chair row and
 *  a walkway. Same rhythm the engine's Tidy uses. */
function deskRows(n: number): number[] {
  const rows: number[] = [];
  for (let r = 1; r < n - 1; r += 3) rows.push(r);
  return rows;
}

/** Desk anchors: 3 cells apart (a 2-wide desk + a 1-cell aisle), ordered from the room's centre
 *  outwards so a small team sits centred instead of jammed against a wall. */
function deskColumns(n: number): number[] {
  const cols: number[] = [];
  for (let c = 0; c + 2 <= n - 1; c += 3) cols.push(c);
  const mid = n / 2;
  return cols.sort((a, b) => Math.abs(a + 1 - mid) - Math.abs(b + 1 - mid) || a - b);
}

/** Zones a player has already furnished. If they own any piece from a zone's character set, the
 *  game leaves that zone alone rather than duplicating its furniture. */
const LOUNGE_OWNED: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "sofa", "sofaL", "armchair", "loungeChair", "bench", "beanbag", "napPod",
  "coffeeTable", "rug", "rugRound", "tvStand", "roundTable",
]);
const STORAGE_OWNED: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "bookshelf", "cabinet", "lockers", "filingCabinet", "shelfUnit", "wardrobe", "trophyCase",
  "serverRack", "printer", "superCluster", "quantumRig", "towerPC", "robotArm", "holoGlobe", "dronePad",
]);
const CULTURE_OWNED: ReadonlySet<FurnitureId> = new Set<FurnitureId>([
  "arcade", "pingpong", "foosball", "poolTable", "vending", "guitar", "watercooler", "treadmill",
  "kombuchaTap", "espressoRobot", "microKitchen", "coffeeBar",
]);

/** Region each zone may use. Work owns the back banks; the lounge the front; storage and the culture
 *  accent the right wall. Exported so the tests can pin "dressing stays in its zone". */
export function dressingAnchors(facilityTier: number): Record<Exclude<ArrangementZone, "work">, CellRect> {
  const n = gridN(Math.max(1, Math.floor(facilityTier)));
  return {
    lounge: { c0: 0, c1: Math.max(0, n - 2), r0: Math.max(0, n - 4), r1: n - 1 },
    storage: { c0: Math.max(0, n - 2), c1: n - 1, r0: 0, r1: Math.max(0, n - 5) },
    culture: { c0: Math.max(0, n - 2), c1: n - 1, r0: 0, r1: Math.max(0, n - 3) },
  };
}

/**
 * Lay out the room for a tier and headcount. The player's `occupied` layout is immovable: every
 * piece is an obstacle, and a zone the player has furnished is skipped entirely. Skips a piece when
 * it cannot be placed (never overlaps, never out of bounds). Pure and stable for the same input.
 */
export function arrangeOffice(input: ArrangeInput): Arrangement {
  const tier = Math.max(1, Math.floor(input.facilityTier));
  const n = gridN(tier);
  const occupied = input.occupied ?? [];
  const era = input.era ?? 0;
  const seed = input.seed ?? 0;
  const week = input.week ?? 0;
  const roll = cosmeticHash01((seed ^ Math.imul((era + 1) >>> 0, 0x9e3779b1)) >>> 0, week, ARRANGEMENT_SALT);

  const reserved = [
    ...fixtureObstacles(tier, { dark: input.dark, amenities: input.amenities, designSuite: input.designSuite, testLab: input.testLab }),
    ...laneObstacles(tier),
  ];
  const pieces: ArrangedPiece[] = [];
  let counter = 0;
  const nextIid = () => `a${++counter}`;
  const room = (): PlacedItem[] => [...occupied, ...reserved, ...pieces];

  /** Density guard: a dressing piece is refused once its zone — or the room's dressing total — is
   *  at the cap. The authored clusters already fit; this keeps a future edit from quietly filling
   *  the room back up. */
  const withinCap = (zone: ArrangementZone): boolean => {
    if (zone === "work") return true;
    const inZone = pieces.filter((p) => p.zone === zone).length;
    const totalDressing = pieces.filter((p) => p.zone !== "work").length;
    return inZone < dressingCap(zone, tier) && totalDressing < dressingTotalCap(tier);
  };

  /** Solid cells currently spoken for (occupied layout, fixtures, and any non-flat placed piece). */
  const cellsTaken = (): Set<string> => {
    const taken = new Set<string>();
    for (const it of room()) {
      if (furnitureDef(it.type).flat) continue;
      const { w, d } = footprint(furnitureDef(it.type), it.rot);
      for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) taken.add(`${it.c + dc},${it.r + dr}`);
    }
    return taken;
  };

  const put = (type: FurnitureId, c: number, r: number, rot: Rot, zone: ArrangementZone): boolean => {
    if (!withinCap(zone) || !canPlace(room(), type, c, r, rot, undefined, tier)) return false;
    const item: ArrangedPiece = { iid: nextIid(), type, c, r, rot, zone };
    if (zone === "work") item.module = workstationModuleFor(stationKey(item), seed, input.monitors ?? 2);
    pieces.push(item);
    return true;
  };

  /** Flats (rugs) are always "placeable" to the engine, so they need their own clearance check:
   *  a dressing rug must not run under solid furniture the player already placed. */
  const putFlat = (type: FurnitureId, c: number, r: number, zone: ArrangementZone): boolean => {
    if (!withinCap(zone)) return false;
    const { w, d } = footprint(furnitureDef(type), 0);
    if (c < 0 || r < 0 || c + w > n || r + d > n) return false;
    const taken = cellsTaken();
    for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) if (taken.has(`${c + dc},${r + dr}`)) return false;
    for (const it of pieces) {
      if (!furnitureDef(it.type).flat) continue;
      const f = footprint(furnitureDef(it.type), it.rot);
      if (c < it.c + f.w && it.c < c + w && r < it.r + f.d && it.r < r + d) return false;
    }
    pieces.push({ iid: nextIid(), type, c, r, rot: 0, zone });
    return true;
  };

  // 1. Work — the back banks, placed first so the zones below yield to it.
  let seats = 0;
  const deskType: FurnitureId = tier >= 2 ? "dualDesk" : "desk";
  for (const r of deskRows(n)) {
    if (seats >= input.headcount) break;
    for (const c of deskColumns(n)) {
      if (seats >= input.headcount) break;
      if (put(deskType, c, r, 0, "work")) seats++;
    }
  }

  // 2. Lounge — front-left, anchored by a rug clear of the printer and the coffee nook. The rug
  //    anchor is scanned: the first spot whose cells are free of solid furniture wins.
  const owned = new Set(occupied.map((it) => it.type));
  const ownsAny = (set: ReadonlySet<FurnitureId>) => [...owned].some((t) => set.has(t));
  if (tier >= 2 && !ownsAny(LOUNGE_OWNED)) {
    const rugRows = [n - 3, n - 4, n - 2];
    let anchor: { c: number; r: number } | null = null;
    for (const r of rugRows) {
      for (const c of [0, 3, 2, 1, 4]) {
        const taken = cellsTaken();
        let clear = c + 3 <= n && r + 2 <= n;
        for (let dc = 0; clear && dc < 3; dc++) for (let dr = 0; clear && dr < 2; dr++) clear = !taken.has(`${c + dc},${r + dr}`);
        if (clear) { anchor = { c, r }; break; }
      }
      if (anchor) break;
    }
    if (anchor) {
      // The cluster is laid out inside the rug's own 3×2 footprint, so it can never be pushed into
      // the front wall: the sectional takes the west half of the rug, the table the east and the
      // lamp stands just off its edge. Four pieces, per the lounge cap — the rug, a seat, a table
      // and one light. The room's own shell plants already give the corner its green.
      const { c: lc, r: lr } = anchor;
      putFlat("rug", lc, lr, "lounge");
      if (tier >= 3) put("sofaL", lc, lr, 0, "lounge");
      else put("loungeChair", lc, lr + 1, 0, "lounge");
      put("coffeeTable", lc + 2, lr + 1, 0, "lounge");
      put("floorLamp", lc + 3, lr, 0, "lounge");
    }
  }

  // 3. Research / storage — a run against the right wall, fronts into the room. Each piece takes the
  //    first free row from where the run left off, so a fixture at the back corner shifts the run
  //    rather than erasing it.
  if (tier >= 2 && !ownsAny(STORAGE_OWNED)) {
    const storageTypes: FurnitureId[] = tier >= 3 ? ["shelfUnit", "serverRack", "bookshelf"] : ["shelfUnit", "serverRack"];
    let row = 0;
    for (const type of storageTypes) {
      for (let r = row; r < n; r++) {
        if (put(type, n - 1, r, 3, "storage")) { row = r + 1; break; }
      }
    }
  }

  // 4. Culture — one arcade accent on the right wall, below the storage run and above the lounge.
  //    The first free row is tried; which row the scan STARTS at comes from the derived cosmetic
  //    stream, so the same (seed, week, era, tier) always gives the same room.
  if (tier >= 2 && !ownsAny(CULTURE_OWNED)) {
    const lo = 3;
    const hi = Math.max(lo, n - 5);
    const start = lo + Math.floor(roll * (hi - lo + 1));
    for (let i = 0; i <= hi - lo; i++) {
      const r = lo + ((start - lo + i) % (hi - lo + 1));
      if (put("arcade", n - 1, r, 3, "culture")) break;
    }
  }

  // Dressing reads relationships with the whole room (including work desks); seats and wall pieces
  // store the derived quarter turn so the layout data agrees with what renders.
  for (const piece of pieces) {
    if (piece.zone === "work") continue; // desks keep rot 0: the seat plan reserved their chair band for it
    piece.rot = rotForYaw(derivedYawFor(piece, pieces, tier));
  }

  return {
    facilityTier: tier,
    pieces,
    dressing: pieces.filter((p) => p.zone !== "work"),
    seats,
  };
}
