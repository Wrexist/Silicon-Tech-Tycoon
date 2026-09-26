import { requiredKindsFor } from '../engine/assemblyLine.ts';
import type { MachineKind } from '../engine/factoryFloor.ts';
import type { CategoryId } from '../engine/types.ts';

export function factoryAnimationKinds(category?: CategoryId, sideKinds: readonly MachineKind[] = []): MachineKind[] {
  return [...new Set<MachineKind>(['intake', 'packer', 'arm', ...(category ? requiredKindsFor(category) : []), ...sideKinds])];
}
export function animationDelta(seconds: number, stopped: boolean, reduced: boolean): number {
  return stopped || reduced || !Number.isFinite(seconds) ? 0 : Math.max(0, Math.min(seconds, .05));
}
/** In-place visual transport only: never changes production progress or the simulation clock. */
export function advanceFactoryItems(items: number[], length: number, seconds: number, active: boolean, connected: boolean, overtime: boolean) {
  if (!active || !connected || length <= 0) return;
  const distance = (overtime ? 2.1 : 1.25) * animationDelta(seconds, false, false);
  for (let i=0; i<items.length; i++) items[i] = (items[i] + distance) % length;
}
