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
import { BELT_COST, machineInvested, machineLevel, machineUpgradeStepCost, type FactoryFloor } from "./factoryFloor.ts";
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

/** Match ownership first, then equivalent pieces already occupying the target cell, one-to-one. */
function matchOwned<T extends { id: string; kind: string; c: number; r: number }>(current: readonly T[], target: readonly T[]): Map<string, T> {
  const matches = new Map<string, T>(), used = new Set<string>();
  for (const t of target) {
    const m = current.find(c => c.id === t.id && c.kind === t.kind);
    if (m) { matches.set(t.id, m); used.add(m.id); }
  }
  for (const t of target) if (!matches.has(t.id)) {
    const m = current.find(c => !used.has(c.id) && c.kind === t.kind && c.c === t.c && c.r === t.r);
    if (m) { matches.set(t.id, m); used.add(m.id); }
  }
  return matches;
}

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
  const bKey = (b: { c: number; r: number }) => `${b.c},${b.r}`;

  const curMachines = matchOwned(current.machines, target.machines);
  const retainedMachines = new Set([...curMachines.values()].map(m => m.id));
  const curB = new Set(current.belts.map(bKey));
  const tgtB = new Set(target.belts.map(bKey));
  const curP = matchOwned(currentProps, targetProps);
  const retainedProps = new Set([...curP.values()].map(p => p.id));

  let total = 0;

  // Machines: a match by cell+kind charges only the UPGRADE-level delta (full for tune-ups, 50% back
  // when the layout is less tuned); a brand-new machine costs its full invested price (base + any
  // upgrades) and a dropped one refunds half of what it cost. So no layout can mint free upgrades.
  for (const m of target.machines) {
    const cur = curMachines.get(m.id);
    if (!cur) { total += machineInvested(m.kind, machineLevel(m)); continue; }
    const from = machineLevel(cur), to = machineLevel(m);
    if (to > from) for (let l = from; l < to; l++) total += machineUpgradeStepCost(m.kind, l) ?? 0;
    else if (to < from) total -= half(machineInvested(m.kind, from) - machineInvested(m.kind, to));
  }
  for (const m of current.machines) if (!retainedMachines.has(m.id)) total -= half(machineInvested(m.kind, machineLevel(m)));
  // Belts: cell identity only (re-aiming is free), pay full for new tiles, refund half for removed.
  for (const b of target.belts) if (!curB.has(bKey(b))) total += BELT_COST;
  for (const b of current.belts) if (!tgtB.has(bKey(b))) total -= half(BELT_COST);
  // Props: same as machines.
  for (const p of targetProps) if (!curP.has(p.id)) total += PROP_DEFS[p.kind].cost;
  for (const p of currentProps) if (!retainedProps.has(p.id)) total -= half(PROP_DEFS[p.kind].cost);

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
  const bKey = (b: { c: number; r: number }) => `${b.c},${b.r}`;
  const machines = matchOwned(current.machines, target.machines);
  const props = matchOwned(currentProps, targetProps);
  const curB = new Set(current.belts.map(bKey)), tgtB = new Set(target.belts.map(bKey));
  let added = target.machines.length - machines.size + targetProps.length - props.size;
  let removed = current.machines.length - machines.size + currentProps.length - props.size;
  for (const k of tgtB) if (!curB.has(k)) added++;
  for (const k of curB) if (!tgtB.has(k)) removed++;
  return { added, removed };
}

export function layoutEditSummary(current: FactoryFloor, currentProps: readonly PlacedProp[], target: FactoryFloor, targetProps: readonly PlacedProp[]): string {
  const diff = layoutDiff(current, currentProps, target, targetProps);
  const machines = matchOwned(current.machines, target.machines), props = matchOwned(currentProps, targetProps);
  const moved = target.machines.filter(t => { const c = machines.get(t.id); return c && (c.c !== t.c || c.r !== t.r); }).length
    + targetProps.filter(t => { const c = props.get(t.id); return c && (c.c !== t.c || c.r !== t.r); }).length;
  const levels = target.machines.filter(t => { const c = machines.get(t.id); return c && machineLevel(c) !== machineLevel(t); }).length;
  const aimed = target.belts.filter(t => current.belts.some(c => c.c === t.c && c.r === t.r && c.dir !== t.dir)).length;
  return [`${diff.added} added`, `${diff.removed} removed`, `${moved} moved`, `${levels} level changes`, `${aimed} belts redirected`].join(" ? ");
}
