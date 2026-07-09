// Decorative props the player can place on the factory floor (crates, plants, benches, signs…) to
// dress the building — cosmetic only, inert to the sim. PURE: the catalog + grid placement math,
// mirroring factoryFloor.ts. Props live in a separate list from machines/belts so the protected
// floor engine is untouched; they may sit on any EMPTY cell (never on a machine, belt, or prop).
import { dollars, type Money } from "./money.ts";
import { FLOOR, machineCells, type FactoryFloor } from "./factoryFloor.ts";

export type PropKind =
  | "crates" | "barrel" | "pallet" | "plant" | "bench" | "rack" | "cone" | "sign"
  // FACTORY-WORLD beauty pass — additive decor (save-safe: persistence.cleanProps keeps only
  // kinds present in PROP_DEFS, so appending here can never break an older save).
  | "hazardStripe" | "extinguisher" | "bollards" | "fan" | "workLight"
  | "tote" | "compressor" | "toolWall" | "qcStation" | "gantry";

export interface PropDef {
  kind: PropKind;
  name: string;
  cost: Money;
  w: number;
  d: number;
}

export const PROP_DEFS: Record<PropKind, PropDef> = {
  crates: { kind: "crates", name: "Crates", cost: dollars(300) as Money, w: 1, d: 1 },
  barrel: { kind: "barrel", name: "Barrels", cost: dollars(250) as Money, w: 1, d: 1 },
  pallet: { kind: "pallet", name: "Pallet", cost: dollars(150) as Money, w: 1, d: 1 },
  plant: { kind: "plant", name: "Planter", cost: dollars(400) as Money, w: 1, d: 1 },
  bench: { kind: "bench", name: "Workbench", cost: dollars(600) as Money, w: 2, d: 1 },
  rack: { kind: "rack", name: "Shelving", cost: dollars(800) as Money, w: 2, d: 1 },
  cone: { kind: "cone", name: "Safety cone", cost: dollars(80) as Money, w: 1, d: 1 },
  sign: { kind: "sign", name: "Hazard sign", cost: dollars(120) as Money, w: 1, d: 1 },
  // — new decor —
  hazardStripe: { kind: "hazardStripe", name: "Hazard stripe", cost: dollars(60) as Money, w: 1, d: 1 },
  extinguisher: { kind: "extinguisher", name: "Extinguisher", cost: dollars(120) as Money, w: 1, d: 1 },
  bollards: { kind: "bollards", name: "Bollards", cost: dollars(110) as Money, w: 1, d: 1 },
  fan: { kind: "fan", name: "Pedestal fan", cost: dollars(300) as Money, w: 1, d: 1 },
  workLight: { kind: "workLight", name: "Work light", cost: dollars(260) as Money, w: 1, d: 1 },
  tote: { kind: "tote", name: "Liquid tote", cost: dollars(350) as Money, w: 1, d: 1 },
  compressor: { kind: "compressor", name: "Compressor", cost: dollars(400) as Money, w: 1, d: 1 },
  toolWall: { kind: "toolWall", name: "Tool wall", cost: dollars(500) as Money, w: 2, d: 1 },
  qcStation: { kind: "qcStation", name: "QC station", cost: dollars(700) as Money, w: 2, d: 1 },
  gantry: { kind: "gantry", name: "Gantry crane", cost: dollars(2400) as Money, w: 3, d: 1 },
};

export interface PlacedProp { id: string; kind: PropKind; c: number; r: number }

export function propCells(p: { kind: PropKind; c: number; r: number }): string[] {
  const def = PROP_DEFS[p.kind];
  const out: string[] = [];
  for (let dc = 0; dc < def.w; dc++) for (let dr = 0; dr < def.d; dr++) out.push(`${p.c + dc},${p.r + dr}`);
  return out;
}

/** Every cell occupied by any prop — the blocked-set machines, belts, and the auto-router must
 *  respect so decor is solid both ways (props already refuse machine/belt cells; this is the
 *  mirror). Pure. */
export function propCellSet(props: PlacedProp[]): Set<string> {
  const out = new Set<string>();
  for (const p of props) for (const cell of propCells(p)) out.add(cell);
  return out;
}

/** World-space centre of a placed prop (for rendering), sharing the floor's coordinate system. */
export function propCenter(p: PlacedProp): [number, number] {
  const def = PROP_DEFS[p.kind];
  return [p.c - (FLOOR.w - 1) / 2 + (def.w - 1) / 2, p.r - (FLOOR.h - 1) / 2 + (def.d - 1) / 2];
}

/** A prop may sit only on empty cells — never overlapping a machine, a belt, or another prop. */
export function canPlaceProp(floor: FactoryFloor, props: PlacedProp[], kind: PropKind, c: number, r: number, maxW: number = FLOOR.w): boolean {
  const def = PROP_DEFS[kind];
  if (c < 0 || r < 0 || c + def.w > maxW || r + def.d > FLOOR.h) return false;
  const want = new Set(propCells({ kind, c, r }));
  for (const m of floor.machines) for (const cell of machineCells(m)) if (want.has(cell)) return false;
  for (const b of floor.belts) if (want.has(`${b.c},${b.r}`)) return false;
  for (const pp of props) for (const cell of propCells(pp)) if (want.has(cell)) return false;
  return true;
}

export function placeProp(floor: FactoryFloor, props: PlacedProp[], kind: PropKind, c: number, r: number, id: string, maxW: number = FLOOR.w): PlacedProp[] | null {
  if (!canPlaceProp(floor, props, kind, c, r, maxW)) return null;
  return [...props, { id, kind, c, r }];
}

/** Relocate a placed prop to a new anchor cell (id + kind preserved) — the pick-up-and-move
 *  gesture. Valid iff the footprint fits with the prop itself ignored; null when it doesn't. Pure. */
export function moveProp(floor: FactoryFloor, props: PlacedProp[], id: string, c: number, r: number, maxW: number = FLOOR.w): PlacedProp[] | null {
  const p = props.find((x) => x.id === id);
  if (!p) return null;
  if (!canPlaceProp(floor, props.filter((x) => x.id !== id), p.kind, c, r, maxW)) return null;
  return props.map((x) => (x.id === id ? { ...x, c, r } : x));
}

export function removePropAt(props: PlacedProp[], c: number, r: number): PlacedProp[] {
  const key = `${c},${r}`;
  return props.filter((p) => !propCells(p).includes(key));
}

/** Half the cost back for whichever prop occupies the cell (0 if none). */
export function propRefund(props: PlacedProp[], c: number, r: number): Money {
  const key = `${c},${r}`;
  for (const p of props) if (propCells(p).includes(key)) return Math.round(PROP_DEFS[p.kind].cost / 2) as Money;
  return 0 as Money;
}
