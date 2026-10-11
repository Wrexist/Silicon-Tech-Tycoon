import { MACHINE_DEFS, machineCenter, type FactoryFloor, type MachineKind } from "../engine/factoryFloor.ts";
import type { MachineMount } from "./machineMounts.ts";

// The factory's crew (handoff gap F6): the office's robots, put to work. One operator stands at each
// connected processing station — on the machine's own service footprint, on the far side from its
// belt station, facing the line — so a running floor reads as staffed. Pure presentation: derived
// from the floor alone (no RNG, no engine reads), so a given layout always has the same crew.

export interface CrewSpot { id: string; x: number; z: number; yaw: number; colorIdx: number; seed: number }

/** Machines that work THROUGH a belt station (their head rides the belt, their footprint is the
 *  service base, so there is room to stand). The Intake and Packer fill their footprint, and the
 *  Assembly Arm is a robot already. */
const CREWED: ReadonlySet<MachineKind> = new Set<MachineKind>(["mill", "press", "screen", "qa"]);

const idHash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export function factoryCrewSpots(floor: FactoryFloor, mounts: ReadonlyMap<string, MachineMount>, connected: ReadonlySet<string>): CrewSpot[] {
  const out: CrewSpot[] = [];
  for (const m of floor.machines) {
    const mount = mounts.get(m.id);
    if (!connected.has(m.id) || !CREWED.has(m.kind) || !mount) continue;
    const [cx, cz] = machineCenter(m);
    const def = MACHINE_DEFS[m.kind];
    // From the station towards the footprint centre, and on past it: the operator stands behind the
    // machine, never on the belt. Kept INSIDE the footprint (the floor is already validated there), so
    // a machine against a wall can't put its operator in the wall.
    let dx = cx - mount.point[0], dz = cz - mount.point[1];
    const len = Math.hypot(dx, dz);
    if (len > 1e-6) { dx /= len; dz /= len; } else { dx = 0; dz = 1; }
    const inset = Math.max(0, Math.min(def.w, def.d) / 2 - 0.3);
    const h = idHash(m.id);
    out.push({ id: m.id, x: cx + dx * inset, z: cz + dz * inset, yaw: Math.atan2(-dx, -dz), colorIdx: h % 5, seed: (h % 997) / 997 });
  }
  return out;
}
