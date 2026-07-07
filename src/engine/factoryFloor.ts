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

export interface PlacedMachine { id: string; kind: MachineKind; c: number; r: number; /** 1..MACHINE_MAX_LEVEL; missing = 1 (legacy floors). */ level?: number }

// Per-machine upgrades — a floor spend sink that speeds the line. A machine can be tuned up to
// MACHINE_MAX_LEVEL; each step costs a multiple of the machine's base price, and each level above 1
// shaves build time (see lineSpeedMult). Starter machines are all level 1, so the baseline is neutral.
export const MACHINE_MAX_LEVEL = 3;
const UPGRADE_STEP_MULT = [0.75, 1.25]; // cost of level 1→2, then 2→3, as a multiple of base cost
export function machineLevel(m: { level?: number }): number {
  return Math.max(1, Math.min(MACHINE_MAX_LEVEL, Math.floor(m.level ?? 1)));
}
/** Cost to take a machine of `kind` from `level` to `level+1`, or null if already maxed. */
export function machineUpgradeStepCost(kind: MachineKind, level: number): Money | null {
  const lvl = machineLevel({ level });
  if (lvl >= MACHINE_MAX_LEVEL) return null;
  return Math.round(MACHINE_DEFS[kind].cost * UPGRADE_STEP_MULT[lvl - 1]) as Money;
}
/** Total spent to reach `level` (base + every upgrade step) — the basis for the demolition refund. */
export function machineInvested(kind: MachineKind, level: number): Money {
  let sum = MACHINE_DEFS[kind].cost as number;
  const lvl = machineLevel({ level });
  for (let l = 1; l < lvl; l++) sum += machineUpgradeStepCost(kind, l) ?? 0;
  return sum as Money;
}
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

/** Relocate a placed machine to a new anchor cell (id, kind and upgrade level preserved) — the
 *  pick-up-and-move gesture. Valid iff the footprint fits with the machine itself ignored; null
 *  when it doesn't. Pure. */
export function moveMachine(floor: FactoryFloor, id: string, c: number, r: number, maxW: number = FLOOR.w): FactoryFloor | null {
  const m = floor.machines.find((x) => x.id === id);
  if (!m) return null;
  const others: FactoryFloor = { ...floor, machines: floor.machines.filter((x) => x.id !== id) };
  if (!canPlaceMachine(others, m.kind, c, r, maxW)) return null;
  return { ...floor, machines: floor.machines.map((x) => (x.id === id ? { ...x, c, r } : x)) };
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

/** The starter factory every new game (and backfilled save) receives.
 *  Deliberately just a BEGINNING and an END — the Intake and the Packer, no belts, no
 *  other machines — so building the line is the player's game: lay it by hand, or tap Auto to route
 *  the optimal path for money. An unwired floor is never a penalty (the contract factory carries
 *  you); a wired one is a build-speed bonus you earn (see lineSpeedMult). */
export function starterFloor(): FactoryFloor {
  return {
    machines: [
      { id: "st-intake", kind: "intake", c: 0, r: 1 }, // material enters top-left
      { id: "st-packer", kind: "packer", c: 0, r: 6 }, // ships bottom-left, by the dock
    ],
    belts: [],
  };
}

/** The REFERENCE full floor — the classic two-lane horseshoe covering every machine kind. Not what
 *  new games start with (that's the bare starterFloor); used by tests and screenshot staging as a
 *  known-good complete layout. Material enters top-left, runs east through mill → press → screen,
 *  turns down, then runs west past arm → QA to the packer at bottom-left. */
export function demoFloor(): FactoryFloor {
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

// Auto-route tuning: a turn costs as much as ROUTE_TURN_COST extra tiles, so legs prefer long
// straight runs and the routed line reads as clean lanes instead of staircase zigzags. The stage
// order is the canonical recipe sequence every device family follows (see LINE_RECIPES): chassis
// work first, then boards, screens, assembly, and QA last before packing — so the tour flows like
// a real production line instead of criss-crossing to whichever machine is nearest.
const ROUTE_TURN_COST = 2;
const ROUTE_STAGE_ORDER: readonly MachineKind[] = ["mill", "press", "screen", "arm", "qa"];

/** Auto-route a fresh belt chain that runs from the Intake, THROUGH every processing machine in
 *  recipe order, to the Packer. Legs are found with a turn-penalised shortest path (Dijkstra over
 *  cell+heading states, FIFO buckets) and heading carries across legs, so the whole line comes out
 *  straight and calm — long lanes, few corners, no staircases. Returns a new floor with belts
 *  replaced, or null if there's no Intake+Packer / no clear path. Pure + deterministic (fixed
 *  cell, direction, and machine order; FIFO tie-breaks). `blockedCells` marks extra impassable
 *  cells (decor props) the route must go around. */
export function autoRouteBelts(floor: FactoryFloor, maxW: number = FLOOR.w, blockedCells?: Iterable<string>): FactoryFloor | null {
  const intake = floor.machines.find((m) => m.kind === "intake");
  const packer = floor.machines.find((m) => m.kind === "packer");
  if (!intake || !packer) return null;
  const W = maxW, H = FLOOR.h;
  const blocked = new Set<string>(blockedCells);
  for (const m of floor.machines) for (const cell of machineCells(m)) blocked.add(cell);
  const free = (c: number, r: number) => c >= 0 && c < W && r >= 0 && r < H && !blocked.has(`${c},${r}`);
  const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const K = (c: number, r: number) => `${c},${r}`;

  // Free cells orthogonally beside a machine's footprint — a belt here runs the item through it.
  const besideCells = (m: PlacedMachine): [number, number][] => {
    const out: [number, number][] = [], seen = new Set<string>();
    for (const s of machineCells(m)) {
      const [mc, mr] = s.split(",").map(Number);
      for (const [dc, dr] of DIRS) {
        const c = mc + dc, r = mr + dr, k = K(c, r);
        if (free(c, r) && !seen.has(k)) { seen.add(k); out.push([c, r]); }
      }
    }
    return out;
  };

  // Turn-penalised shortest path from `start` (arriving with heading `startDir`, -1 = none) to ANY
  // goal cell, over free cells not already used by the path so far. Cost = tiles + turns×penalty.
  // Bucket queue (FIFO within a cost) keeps expansion order — and therefore ties — deterministic.
  type Leg = { cells: [number, number][]; endDir: number; cost: number };
  const legSearch = (start: [number, number], startDir: number, goals: Set<string>, used: Set<string>): Leg | null => {
    if (goals.has(K(start[0], start[1]))) return { cells: [start], endDir: startDir, cost: 0 };
    const stateOf = (c: number, r: number, d: number) => (r * W + c) * 5 + (d + 1);
    const startState = stateOf(start[0], start[1], startDir);
    const dist = new Map<number, number>([[startState, 0]]);
    const prev = new Map<number, number>();
    const buckets: (number[] | undefined)[] = [[startState]];
    let maxCost = 0;
    for (let cost = 0; cost <= maxCost; cost++) {
      const bucket = buckets[cost];
      if (!bucket) continue;
      for (let h = 0; h < bucket.length; h++) {
        const s = bucket[h];
        if ((dist.get(s) ?? Infinity) !== cost) continue; // stale entry — a cheaper path got there first
        const d = (s % 5) - 1;
        const cell = (s - (d + 1)) / 5;
        const c = cell % W, r = (cell - c) / W;
        // First non-stale pop of a goal cell = the cheapest way in (costs rise monotonically,
        // FIFO within a cost level keeps ties deterministic).
        if (goals.has(K(c, r))) {
          const cells: [number, number][] = [];
          for (let cur: number | undefined = s; cur !== undefined; cur = prev.get(cur)) {
            const dd = (cur % 5) - 1, cc = (cur - (dd + 1)) / 5;
            cells.push([cc % W, (cc - (cc % W)) / W]);
          }
          cells.reverse();
          return { cells, endDir: d, cost };
        }
        for (let nd = 0; nd < 4; nd++) {
          const nc = c + DIRS[nd][0], nr = r + DIRS[nd][1];
          if (!free(nc, nr) || used.has(K(nc, nr))) continue;
          const ncost = cost + 1 + (d !== -1 && d !== nd ? ROUTE_TURN_COST : 0);
          const ns = stateOf(nc, nr, nd);
          if ((dist.get(ns) ?? Infinity) <= ncost) continue;
          dist.set(ns, ncost);
          prev.set(ns, s);
          (buckets[ncost] ??= []).push(ns);
          if (ncost > maxCost) maxCost = ncost;
        }
      }
    }
    return null;
  };

  const processing = floor.machines.filter((m) => m.kind !== "intake" && m.kind !== "packer");
  const packerGoals = new Set(besideCells(packer).map(([c, r]) => K(c, r)));
  if (packerGoals.size === 0) return null;

  // Run the tour from EVERY Intake-side start cell and keep the cheapest complete one — the first
  // workable start isn't always the clean one (a corner start adds a pointless hook at the head).
  // Deterministic: fixed start order, strict < so ties keep the earliest.
  let bestPath: [number, number][] | null = null;
  let bestTotal = Infinity;
  for (const start of besideCells(intake)) {
    const path: [number, number][] = [start];
    const used = new Set<string>([K(start[0], start[1])]);
    let cur = start, curDir = -1, total = 0;
    // Visit machines grouped by the canonical stage order; within a stage, cheapest leg first.
    // Unknown kinds (future machines) fall in after QA so they're still covered.
    const stagePools: PlacedMachine[][] = ROUTE_STAGE_ORDER.map((k) => processing.filter((m) => m.kind === k));
    stagePools.push(processing.filter((m) => !ROUTE_STAGE_ORDER.includes(m.kind)));
    for (const pool of stagePools) {
      const remaining = [...pool];
      while (remaining.length) {
        let best: Leg | null = null, bestIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
          const goals = new Set(besideCells(remaining[i]).map(([c, r]) => K(c, r)));
          if (goals.size === 0) continue;
          const leg = legSearch(cur, curDir, goals, used);
          if (leg && (!best || leg.cost < best.cost)) { best = leg; bestIdx = i; }
        }
        if (!best) break; // the rest of this stage is unreachable — carry on with the next stage
        for (const c of best.cells.slice(1)) { path.push(c); used.add(K(c[0], c[1])); }
        cur = best.cells[best.cells.length - 1];
        curDir = best.endDir;
        total += best.cost;
        remaining.splice(bestIdx, 1);
      }
    }
    const finalLeg = legSearch(cur, curDir, packerGoals, used);
    if (!finalLeg) continue; // this start can't reach the Packer — try the next
    for (const c of finalLeg.cells.slice(1)) { path.push(c); used.add(K(c[0], c[1])); }
    total += finalLeg.cost;
    if (total < bestTotal) { bestTotal = total; bestPath = path; }
  }
  if (!bestPath) return null;

  const dirOf = (from: [number, number], to: [number, number]): BeltDir => {
    const dc = to[0] - from[0], dr = to[1] - from[1];
    return dc > 0 ? "e" : dc < 0 ? "w" : dr > 0 ? "s" : "n";
  };
  const path = bestPath;
  const belts: BeltTile[] = path.map((cell, i) => {
    if (i < path.length - 1) return { c: cell[0], r: cell[1], dir: dirOf(cell, path[i + 1]) };
    let best: BeltDir = "e", bestD = Infinity; // final tile aims into the Packer
    for (const s of machineCells(packer)) {
      const [mc, mr] = s.split(",").map(Number);
      const dc = mc - cell[0], dr = mr - cell[1], d = Math.abs(dc) + Math.abs(dr);
      if (d < bestD) { bestD = d; best = Math.abs(dc) >= Math.abs(dr) ? (dc >= 0 ? "e" : "w") : (dr >= 0 ? "s" : "n"); }
    }
    return { c: cell[0], r: cell[1], dir: best };
  });
  // Guard: a route that doesn't actually wire Intake→Packer (e.g. a single tile when the two sit
  // one cell apart) must return null, not a floor. autoConnectQuote reads this to price + arm the
  // Auto tile, so returning an incomplete line would charge BELT_COST for a line that never runs.
  const routed = { ...floor, belts };
  return lineComplete(routed) ? routed : null;
}

/** How the player-built line affects production — a build-TIME multiplier the sim reads.
 *  The floor is PURE UPSIDE, anchored so a company that never touches it plays the exact baseline:
 *    • no wired line (new games start with just an Intake and a Packer) → ×1, NEUTRAL — the
 *      contract factory carries you; an empty floor is an invitation, never a punishment.
 *    • a COMPLETE Intake→Packer line earns a bonus: ×0.92 base (−8% build time) with the full
 *      toolkit, each extra assembly arm shaving ~5% more and each machine upgrade level ~2%,
 *      down to a ×0.55 floor.
 *    • TOPOLOGY: if `requiredKinds` (the product's recipe machines) are given, the bonus scales
 *      with COVERAGE — a freshly wired Intake→Packer keeps 25% of it, and every recipe machine
 *      the player adds grows it toward the full 100%. Every purchase on the $40K+ climb moves
 *      the number; there is no dead zone where wiring the line pays nothing.
 *  Pure + bounded ≤1 (never a penalty); no RNG, so the determinism pin is untouched. */
export function lineSpeedMult(floor: FactoryFloor, requiredKinds?: Iterable<MachineKind>): number {
  if (!lineComplete(floor)) return 1;
  const arms = floor.machines.filter((m) => m.kind === "arm").length;
  const upg = floor.machines.reduce((s, m) => s + (machineLevel(m) - 1), 0);
  const raw = Math.max(0.55, 0.92 - 0.05 * Math.max(0, arms - 1) - 0.02 * upg);
  let bonus = 1 - raw; // the full-toolkit bonus this floor has earned
  if (requiredKinds) {
    const present = new Set(floor.machines.map((m) => m.kind));
    let total = 0, covered = 0;
    for (const k of requiredKinds) { total++; if (present.has(k)) covered++; }
    if (total > 0) bonus *= 0.25 + 0.75 * (covered / total);
  }
  return Math.min(1, Math.max(0.55, 1 - bonus));
}

/** Which of a device's required machine kinds are NOT on the floor — surfaced in the HUD so the
 *  player knows what to build to speed a given product up. Pure. */
export function missingMachineKinds(floor: FactoryFloor, requiredKinds: Iterable<MachineKind>): MachineKind[] {
  const present = new Set(floor.machines.map((m) => m.kind));
  const out: MachineKind[] = [];
  for (const k of requiredKinds) if (!present.has(k)) out.push(k);
  return out;
}

/** Cost to upgrade the machine occupying (c,r) one level, or null if none there / already maxed. */
export function machineUpgradeCostAt(floor: FactoryFloor, c: number, r: number): Money | null {
  const key = `${c},${r}`;
  const m = floor.machines.find((x) => machineCells(x).includes(key));
  return m ? machineUpgradeStepCost(m.kind, machineLevel(m)) : null;
}

/** Return a new floor with the machine at (c,r) tuned up one level, or null if it can't be. Pure. */
export function upgradeMachineAt(floor: FactoryFloor, c: number, r: number): FactoryFloor | null {
  const key = `${c},${r}`;
  const idx = floor.machines.findIndex((x) => machineCells(x).includes(key));
  if (idx < 0) return null;
  const m = floor.machines[idx];
  if (machineLevel(m) >= MACHINE_MAX_LEVEL) return null;
  const machines = floor.machines.map((x, i) => (i === idx ? { ...x, level: machineLevel(x) + 1 } : x));
  return { ...floor, machines };
}

/** Demolition pays back half of what the cell's occupant cost — including upgrade spend (never more). */
export function demolitionRefund(floor: FactoryFloor, c: number, r: number): Money {
  const key = `${c},${r}`;
  for (const m of floor.machines) {
    if (machineCells(m).includes(key)) return Math.round(machineInvested(m.kind, machineLevel(m)) / 2) as Money;
  }
  if (floor.belts.some((b) => b.c === c && b.r === r)) return Math.round(BELT_COST / 2) as Money;
  return 0 as Money;
}
