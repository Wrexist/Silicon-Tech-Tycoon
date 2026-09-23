import { canPlaceBelt, canPlaceMachine, floorWidth, type FactoryFloor } from './factoryFloor.ts';
import { canPlaceProp, type PlacedProp } from './factoryProps.ts';

/** Reject impossible geometry without silently deleting owned pieces. Shared import/blueprint gate. */
export function validFactoryPlacement(floor: FactoryFloor, props: PlacedProp[], expansion: number): boolean {
  const built: FactoryFloor = { machines: [], belts: [] };
  const placed: PlacedProp[] = [];
  const ids = new Set<string>();
  const width = floorWidth(expansion);
  for (const m of floor.machines) {
    if (!m.id || ids.has(m.id) || !canPlaceMachine(built, m.kind, m.c, m.r, width)) return false;
    ids.add(m.id); built.machines.push(m);
  }
  for (const b of floor.belts) {
    if (!canPlaceBelt(built, b.c, b.r, width) || built.belts.some(x => x.c === b.c && x.r === b.r)) return false;
    built.belts.push(b);
  }
  for (const p of props) {
    if (!p.id || ids.has(p.id) || !canPlaceProp(built, placed, p.kind, p.c, p.r, width)) return false;
    ids.add(p.id); placed.push(p);
  }
  return true;
}
