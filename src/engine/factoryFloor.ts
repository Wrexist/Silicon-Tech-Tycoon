// Factory floor grid — the player-buildable machine & conveyor layout (Factory Mode F2).
// PURE: grid math, placement validation, the machine catalog, and belt path-chaining that
// the 3D scene renders and the traveling items follow. Mirrors the furniture.ts discipline.
import { dollars, type Money } from "./money.ts";

export const FLOOR = { w: 16, h: 10 } as const; // cells; world = (c - 7.5, r - 4.5)

export type MachineKind = "intake" | "press" | "arm" | "qa" | "packer";
export type BeltDir = "e" | "w" | "n" | "s";

export interface MachineDef {
  kind: MachineKind;
  name: string;
  blurb: string;
  cost: Money;
  /** Which BuildProgress stage this machine works (lights up when the real build is there). */
  stageIdx: number;
  w: number;
  d: number;
}

export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  intake: { kind: "intake", name: "Intake Hopper", blurb: "Feeds raw material onto the line.", cost: dollars(6_000) as Money, stageIdx: 0, w: 2, d: 2 },
  press: { kind: "press", name: "Gantry Press", blurb: "Stamps slabs into logic boards.", cost: dollars(14_000) as Money, stageIdx: 1, w: 3, d: 2 },
  arm: { kind: "arm", name: "Assembly Arm", blurb: "Robot cell that builds the device.", cost: dollars(18_000) as Money, stageIdx: 2, w: 2, d: 2 },
  qa: { kind: "qa", name: "QA Tunnel", blurb: "Scans every unit before packing.", cost: dollars(12_000) as Money, stageIdx: 3, w: 2, d: 2 },
  packer: { kind: "packer", name: "Packing Station", blurb: "Boxes finished devices for the dock.", cost: dollars(9_000) as Money, stageIdx: 4, w: 2, d: 2 },
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

export function canPlaceMachine(floor: FactoryFloor, kind: MachineKind, c: number, r: number): boolean {
  const def = MACHINE_DEFS[kind];
  if (c < 0 || r < 0 || c + def.w > FLOOR.w || r + def.d > FLOOR.h) return false;
  const want = new Set(machineCells({ kind, c, r }));
  for (const m of floor.machines) for (const cell of machineCells(m)) if (want.has(cell)) return false;
  for (const b of floor.belts) if (want.has(`${b.c},${b.r}`)) return false;
  return true;
}

export function canPlaceBelt(floor: FactoryFloor, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= FLOOR.w || r >= FLOOR.h) return false;
  for (const m of floor.machines) if (machineCells(m).includes(`${c},${r}`)) return false;
  return true; // an existing belt at the cell is replaced (re-aim), not blocked
}

export function placeMachine(floor: FactoryFloor, kind: MachineKind, c: number, r: number, id: string): FactoryFloor | null {
  if (!canPlaceMachine(floor, kind, c, r)) return null;
  return { ...floor, machines: [...floor.machines, { id, kind, c, r }] };
}

export function placeBelt(floor: FactoryFloor, c: number, r: number, dir: BeltDir): FactoryFloor | null {
  if (!canPlaceBelt(floor, c, r)) return null;
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

/** Chain directed belt tiles into the LONGEST path (world points) — the items' route.
 *  A start is any tile no other tile feeds into; walks follow each tile's own direction. */
export function beltPath(belts: BeltTile[]): [number, number][] {
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

/** The hand-authored starter factory — the S-line the mode ships with (F2 default + backfill). */
export function starterFloor(): FactoryFloor {
  const belts: BeltTile[] = [];
  for (let c = 2; c <= 12; c++) belts.push({ c, r: 1, dir: "e" });
  belts.push({ c: 13, r: 1, dir: "s" }, { c: 13, r: 2, dir: "s" }, { c: 13, r: 3, dir: "s" }, { c: 13, r: 4, dir: "w" });
  for (let c = 12; c >= 3; c--) belts.push({ c, r: 4, dir: "w" });
  belts.push({ c: 2, r: 4, dir: "s" }, { c: 2, r: 5, dir: "s" }, { c: 2, r: 6, dir: "s" }, { c: 2, r: 7, dir: "e" });
  for (let c = 3; c <= 13; c++) belts.push({ c, r: 7, dir: "e" });
  return {
    machines: [
      { id: "st-intake", kind: "intake", c: 0, r: 0 },
      { id: "st-press", kind: "press", c: 5, r: 2 },
      { id: "st-arm", kind: "arm", c: 6, r: 5 },
      { id: "st-qa", kind: "qa", c: 4, r: 8 },
      { id: "st-packer", kind: "packer", c: 14, r: 6 },
    ],
    belts,
  };
}
