import { machineCells, machineCenter, worldOf, type FactoryFloor, type BeltTile } from '../engine/factoryFloor.ts';

export interface MachineMount { point: [number, number]; yaw: number }
/** Derive working heads from adjacent belt tiles, without moving saved service footprints.
 * Prefer straight runs and distinct stations. Remote machinery never snaps to unrelated belts. */
export function machineMounts(floor: FactoryFloor, route: BeltTile[] = floor.belts): Map<string, MachineMount> {
  const result = new Map<string, MachineMount>();
  const used = new Set<string>();
  const at = new Map(route.map(b => [`${b.c},${b.r}`, b]));
  const step = { e: [1,0], w: [-1,0], n: [0,-1], s: [0,1] } as const;
  for (const m of floor.machines) {
    const cells = machineCells(m).map(s => s.split(',').map(Number));
    const [cx,cz] = machineCenter(m);
    const candidates = route.filter(b => cells.some(([c,r]) => Math.abs(c-b.c)+Math.abs(r-b.r) === 1));
    const score = (b: BeltTile) => {
      const [dx,dz] = step[b.dir], prev = at.get(`${b.c-dx},${b.r-dz}`);
      const straight = prev?.dir === b.dir;
      const [x,z] = worldOf(b.c,b.r);
      return (used.has(`${b.c},${b.r}`) ? 1000 : 0) + (straight ? 0 : 100) + (x-cx)**2+(z-cz)**2;
    };
    candidates.sort((a,b) => score(a)-score(b) || a.r-b.r || a.c-b.c);
    const b = candidates[0];
    if (!b) continue;
    used.add(`${b.c},${b.r}`);
    result.set(m.id, { point: worldOf(b.c,b.r), yaw: b.dir === 'e' ? Math.PI/2 : b.dir === 'w' ? -Math.PI/2 : b.dir === 'n' ? Math.PI : 0 });
  }
  return result;
}
