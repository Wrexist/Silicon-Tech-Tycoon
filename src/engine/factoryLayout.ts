// Saved factory layouts — snapshot the hand-built floor (machines, belts, props, decor, expansion)
// under a name, then switch between designs. PURE: the snapshot type + a fair, exploit-free cost to
// apply one layout over another. No React/DOM, fully unit-tested.
//
// Economy: applying a layout is priced as a DIFF, exactly like doing it by hand — you pay the full
// catalog price for anything the target adds, and get the standard 50% demolition refund for
// anything it removes. Cells that already match (same machine/kind, same belt cell, same prop) are
// free, and re-aiming a belt is free (mirrors buyFloorBelt). So there's no "save → demolish for the
// refund → re-apply for free" loop: re-adding always costs full price. (Floor EXPANSIONS are
// permanent and can't be refunded, so the caller prices those separately.)
import { MACHINE_DEFS, BELT_COST, type FactoryFloor } from "./factoryFloor.ts";
import { PROP_DEFS, type PlacedProp } from "./factoryProps.ts";
import { cents, type Money } from "./money.ts";

/** A named snapshot of a complete factory design. Stored in the game save (per company). */
export interface FactoryLayout {
  id: string;
  name: string;
  floor: FactoryFloor;
  props: PlacedProp[];
  expansion: number;
  decor: { wall: number; floor: number };
  savedWeek: number;
}

/** How many named layouts a player can keep at once. */
export const MAX_LAYOUTS = 6;

const half = (c: number): number => Math.round(c / 2); // the standard demolition refund (mirrors demolitionRefund)

/**
 * The NET cost (cents; may be negative = a refund) to transform `current` into `target`, priced as a
 * fair diff against the catalog:
 *   + full build cost of every machine / belt tile / prop the target adds,
 *   − 50% refund of everything the current floor has that the target drops.
 * Matching machines (same cell + kind), belt cells (any direction), and props (same cell + kind) are
 * free. EXCLUDES floor expansions — those are permanent and priced by the caller. Pure.
 */
export function layoutApplyCost(
  current: FactoryFloor,
  currentProps: readonly PlacedProp[],
  target: FactoryFloor,
  targetProps: readonly PlacedProp[],
): Money {
  const mKey = (m: { c: number; r: number; kind: string }) => `${m.c},${m.r},${m.kind}`;
  const bKey = (b: { c: number; r: number }) => `${b.c},${b.r}`;

  const curM = new Set(current.machines.map(mKey));
  const tgtM = new Set(target.machines.map(mKey));
  const curB = new Set(current.belts.map(bKey));
  const tgtB = new Set(target.belts.map(bKey));
  const curP = new Set(currentProps.map(mKey));
  const tgtP = new Set(targetProps.map(mKey));

  let total = 0;

  // Machines: pay full for adds, refund half for drops.
  for (const m of target.machines) if (!curM.has(mKey(m))) total += MACHINE_DEFS[m.kind].cost;
  for (const m of current.machines) if (!tgtM.has(mKey(m))) total -= half(MACHINE_DEFS[m.kind].cost);
  // Belts: cell identity only (re-aiming is free), pay full for new tiles, refund half for removed.
  for (const b of target.belts) if (!curB.has(bKey(b))) total += BELT_COST;
  for (const b of current.belts) if (!tgtB.has(bKey(b))) total -= half(BELT_COST);
  // Props: same as machines.
  for (const p of targetProps) if (!curP.has(mKey(p))) total += PROP_DEFS[p.kind].cost;
  for (const p of currentProps) if (!tgtP.has(mKey(p))) total -= half(PROP_DEFS[p.kind].cost);

  return cents(total);
}

/** How many placed pieces (machines + belt tiles + props) a layout ADDS vs REMOVES relative to the
 *  current floor — surfaced in the apply-confirmation so retooling isn't a blind tap. Pure. */
export function layoutDiff(
  current: FactoryFloor,
  currentProps: readonly PlacedProp[],
  target: FactoryFloor,
  targetProps: readonly PlacedProp[],
): { added: number; removed: number } {
  const mKey = (m: { c: number; r: number; kind: string }) => `${m.c},${m.r},${m.kind}`;
  const bKey = (b: { c: number; r: number }) => `${b.c},${b.r}`;
  const curM = new Set(current.machines.map(mKey)), tgtM = new Set(target.machines.map(mKey));
  const curB = new Set(current.belts.map(bKey)), tgtB = new Set(target.belts.map(bKey));
  const curP = new Set(currentProps.map(mKey)), tgtP = new Set(targetProps.map(mKey));
  let added = 0, removed = 0;
  for (const k of tgtM) if (!curM.has(k)) added++;
  for (const k of curM) if (!tgtM.has(k)) removed++;
  for (const k of tgtB) if (!curB.has(k)) added++;
  for (const k of curB) if (!tgtB.has(k)) removed++;
  for (const k of tgtP) if (!curP.has(k)) added++;
  for (const k of curP) if (!tgtP.has(k)) removed++;
  return { added, removed };
}
