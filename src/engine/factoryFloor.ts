// Factory floor grid — the player-buildable machine & conveyor layout (Factory Mode F2).
// PURE: grid math, placement validation, the machine catalog, and belt path-chaining that
// the 3D scene renders and the traveling items follow. Mirrors the furniture.ts discipline.
import { dollars, type Money } from "./money.ts";

export const FLOOR = { w: 16, h: 10 } as const; // cells; world = (c - 7.5, r - 4.5)

// The machines a factory can build. Devices need different subsets (a phone bonds a screen; a
// laptop mills a chassis) — engine/assemblyLine.ts maps each build stage to the kind that works it.
export type MachineKind = "intake" | "mill" | "press" | "screen" | "arm" | "qa" | "packer";
export type BeltDir = "e" | "w" | "n" | "s";

export interface MachineDef {
  kind: MachineKind;
  name: string;
  blurb: string;
  cost: Money;
  w: number;
  d: number;
}

export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  intake: { kind: "intake", name: "Intake Hopper", blurb: "Feeds raw material onto the line.", cost: dollars(6_000) as Money, w: 2, d: 2 },
  mill: { kind: "mill", name: "CNC Mill", blurb: "Cuts chassis & unibodies from billet.", cost: dollars(16_000) as Money, w: 2, d: 2 },
  press: { kind: "press", name: "Board Press", blurb: "Stamps & populates logic boards.", cost: dollars(14_000) as Money, w: 3, d: 2 },
  screen: { kind: "screen", name: "Screen Bonder", blurb: "Laminates & bonds display panels.", cost: dollars(15_000) as Money, w: 2, d: 2 },
  arm: { kind: "arm", name: "Assembly Arm", blurb: "Robot cell that assembles the device.", cost: dollars(18_000) as Money, w: 2, d: 2 },
  qa: { kind: "qa", name: "Test Station", blurb: "Scans & tests every finished unit.", cost: dollars(12_000) as Money, w: 2, d: 2 },
  packer: { kind: "packer", name: "Packing Station", blurb: "Boxes finished devices for the dock.", cost: dollars(9_000) as Money, w: 2, d: 2 },
};

export const BELT_COST: Money = dollars(400) as Money;

export interface PlacedMachine { id: string; kind: MachineKind; c: number; r: number }
export interface BeltTile { c: number; r: number; dir: BeltDir }
export interface FactoryFloor { machines: PlacedMachine[]; belts: BeltTile[] }

export function worldOf(c: number, r: number): [number, number] {
  return [c - (FLOOR.w - 1) / 2, r - (FLOOR.h - 1) / 2];
}

export function machineCells(m: { kind: MachineKind; c: number; r: number }): string[] {
  const def = MACHINE_DEFS[m.kind];
  const out: string[] = [];
  for (let dc = 0; dc < def.w; dc++) for (let dr = 0; dr < def.d; dr++) out.push(`${m.c + dc},${m.r + dr}`);
  return out;
}

/** World-space centre of a placed machine (for rendering). */
export function machineCenter(m: PlacedMachine): [number, number] {
  const def = MACHINE_DEFS[m.kind];
  const [x0, z0] = worldOf(m.c, m.r);
  return [x0 + (def.w - 1) / 2, z0 + (def.d - 1) / 2];
}

// Floor expansion: the buildable grid grows EAST (extra columns) as the player buys expansions,
// while the coordinate origin stays fixed so an existing layout never shifts. `floorWidth` gives
// the current column count; the bound-checks take it so the extra bays become placeable.
export const EXPAND_STEP = 4;
export const MAX_EXPANSION = 3;
export function floorWidth(expansion: number): number {
  return FLOOR.w + Math.max(0, Math.min(MAX_EXPANSION, expansion)) * EXPAND_STEP;
}

export function canPlaceMachine(floor: FactoryFloor, kind: MachineKind, c: number, r: number, maxW: number = FLOOR.w): boolean {
  const def = MACHINE_DEFS[kind];
  if (c < 0 || r < 0 || c + def.w > maxW || r + def.d > FLOOR.h) return false;
  const want = new Set(machineCells({ kind, c, r }));
  for (const m of floor.machines) for (const cell of machineCells(m)) if (want.has(cell)) return false;
  for (const b of floor.belts) if (want.has(`${b.c},${b.r}`)) return false;
  return true;
}

export function canPlaceBelt(floor: FactoryFloor, c: number, r: number, maxW: number = FLOOR.w): boolean {
  if (c < 0 || r < 0 || c >= maxW || r >= FLOOR.h) return false;
  for (const m of floor.machines) if (machineCells(m).includes(`${c},${r}`)) return false;
  return true; // an existing belt at the cell is replaced (re-aim), not blocked
}

export function placeMachine(floor: FactoryFloor, kind: MachineKind, c: number, r: number, id: string, maxW: number = FLOOR.w): FactoryFloor | null {
  if (!canPlaceMachine(floor, kind, c, r, maxW)) return null;
  return { ...floor, machines: [...floor.machines, { id, kind, c, r }] };
}

export function placeBelt(floor: FactoryFloor, c: number, r: number, dir: BeltDir, maxW: number = FLOOR.w): FactoryFloor | null {
  if (!canPlaceBelt(floor, c, r, maxW)) return null;
  return { ...floor, belts: [...floor.belts.filter((b) => b.c !== c || b.r !== r), { c, r, dir }] };
}

/** Remove whatever occupies the cell (machine by any of its cells, or the belt tile). */
export function removeAt(floor: FactoryFloor, c: number, r: number): FactoryFloor {
  const key = `${c},${r}`;
  const machines = floor.machines.filter((m) => !machineCells(m).includes(key));
  const belts = floor.belts.filter((b) => b.c !== c || b.r !== r);
  if (machines.length === floor.machines.length && belts.length === floor.belts.length) return floor;
  return { machines, belts };
}

const STEP: Record<BeltDir, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };

/** The LONGEST chain of directed belt tiles (each start = a tile nothing feeds into). */
export function beltChain(belts: BeltTile[]): BeltTile[] {
  if (belts.length === 0) return [];
  const at = new Map(belts.map((b) => [`${b.c},${b.r}`, b]));
  const fedInto = new Set(
    belts
      .map((b) => `${b.c + STEP[b.dir][0]},${b.r + STEP[b.dir][1]}`)
      .filter((k) => at.has(k)),
  );
  const starts = belts.filter((b) => !fedInto.has(`${b.c},${b.r}`));
  let best: BeltTile[] = [];
  for (const s of starts.length > 0 ? starts : [belts[0]]) {
    const chain: BeltTile[] = [];
    const seen = new Set<string>();
    let cur: BeltTile | undefined = s;
    while (cur && !seen.has(`${cur.c},${cur.r}`)) {
      chain.push(cur);
      seen.add(`${cur.c},${cur.r}`);
      cur = at.get(`${cur.c + STEP[cur.dir][0]},${cur.r + STEP[cur.dir][1]}`);
    }
    if (chain.length > best.length) best = chain;
  }
  return best;
}

/** Chain directed belt tiles into the LONGEST path (world points) — the items' route. */
export function beltPath(belts: BeltTile[]): [number, number][] {
  const best = beltChain(belts);
  if (best.length === 0) return [];
  const pts = best.map((b) => worldOf(b.c, b.r));
  // extend half a cell past the last tile in its direction so items run off the end cleanly
  if (best.length > 0) {
    const last = best[best.length - 1];
    const [dx, dz] = STEP[last.dir];
    const [lx, lz] = worldOf(last.c, last.r);
    pts.push([lx + dx, lz + dz]);
  }
  return pts;
}

/** Fractions along the path where the item transforms — the nearest path point to each of
 *  press → arm → qa, in that order (fallbacks keep the story sane on partial layouts). */
export function formMarks(floor: FactoryFloor, path: [number, number][]): [number, number, number] {
  const frac = (kind: MachineKind, fallback: number): number => {
    const m = floor.machines.find((mm) => mm.kind === kind);
    if (!m || path.length < 2) return fallback;
    const [mx, mz] = machineCenter(m);
    let bestI = 0;
    let bestD = Infinity;
    path.forEach(([x, z], i) => {
      const d = (x - mx) ** 2 + (z - mz) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    });
    return bestI / (path.length - 1);
  };
  const a = frac("press", 0.18);
  const b = Math.max(frac("arm", 0.5), a + 0.05);
  const c = Math.max(frac("qa", 0.8), b + 0.05);
  return [a, b, c];
}

/** The hand-authored starter factory — a clean horseshoe conveyor the mode ships with (F2 default
 *  + backfill). Two long lanes joined by a right-hand turn: material enters top-left, runs east,
 *  turns down, then runs west to the packer at bottom-left. Machines sit just off each lane in
 *  stage order (intake → press on the top lane, arm → QA → packer on the bottom lane); the 3D scene
 *  snaps them onto the belt so the product runs straight through each one. */
export function starterFloor(): FactoryFloor {
  const belts: BeltTile[] = [];
  // top lane, west→east
  for (let c = 2; c <= 12; c++) belts.push({ c, r: 2, dir: "e" });
  // right-hand turn, down
  belts.push({ c: 13, r: 2, dir: "s" }, { c: 13, r: 3, dir: "s" }, { c: 13, r: 4, dir: "s" }, { c: 13, r: 5, dir: "s" });
  // bottom lane, east→west
  for (let c = 13; c >= 2; c--) belts.push({ c, r: 6, dir: "w" });
  return {
    machines: [
      // top lane, in build order: material → mill → press → screen bonder
      { id: "st-intake", kind: "intake", c: 0, r: 1 }, // feeds the head at (2,2)
      { id: "st-mill", kind: "mill", c: 3, r: 0 },
      { id: "st-press", kind: "press", c: 6, r: 0 },
      { id: "st-screen", kind: "screen", c: 10, r: 0 },
      // bottom lane: assembly → test → pack (at the dock tail)
      { id: "st-arm", kind: "arm", c: 10, r: 7 },       // beside the bottom lane, reaches over
      { id: "st-qa", kind: "qa", c: 5, r: 7 },
      { id: "st-packer", kind: "packer", c: 0, r: 6 },  // boxes at the tail (2,6), by the dock
    ],
    belts,
  };
}

/** Is a tile within one cell (incl. diagonals) of any cell of a machine of `kind`? */
function nearMachine(floor: FactoryFloor, kind: MachineKind, c: number, r: number): boolean {
  for (const m of floor.machines) {
    if (m.kind !== kind) continue;
    for (const cell of machineCells(m)) {
      const [mc, mr] = cell.split(",").map(Number);
      if (Math.abs(mc - c) <= 1 && Math.abs(mr - r) <= 1) return true;
    }
  }
  return false;
}

/** A line RUNS only when the longest belt chain starts beside an Intake and ends beside a
 *  Packer — the factory-tycoon rule that makes layouts meaningful (F3). */
export function lineComplete(floor: FactoryFloor): boolean {
  const chain = beltChain(floor.belts);
  if (chain.length < 2) return false;
  const head = chain[0];
  const tail = chain[chain.length - 1];
  return nearMachine(floor, "intake", head.c, head.r) && nearMachine(floor, "packer", tail.c, tail.r);
}

/** How the player-built line affects production — a build-TIME multiplier the sim reads.
 *  Anchored so the starter (a complete, single-arm line) is exactly NEUTRAL (×1), so the baseline
 *  balance is unchanged. From there the layout MATTERS in two directions:
 *    • a disconnected line (no intake→packer path) costs time (×1.15) — keep it wired.
 *    • extra assembly arms parallelise the build, each shaving ~5% down to a −25% floor.
 *  Pure + bounded; no RNG, so the determinism pin is untouched. */
export function lineSpeedMult(floor: FactoryFloor): number {
  if (!lineComplete(floor)) return 1.15;
  const arms = floor.machines.filter((m) => m.kind === "arm").length;
  return Math.max(0.75, 1 - 0.05 * Math.max(0, arms - 1));
}

/** Demolition pays back half of what the cell's occupant cost (never more). */
export function demolitionRefund(floor: FactoryFloor, c: number, r: number): Money {
  const key = `${c},${r}`;
  for (const m of floor.machines) {
    if (machineCells(m).includes(key)) return Math.round(MACHINE_DEFS[m.kind].cost / 2) as Money;
  }
  if (floor.belts.some((b) => b.c === c && b.r === r)) return Math.round(BELT_COST / 2) as Money;
  return 0 as Money;
}
