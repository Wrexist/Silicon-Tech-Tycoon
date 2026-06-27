// HQ upgrade → office highlight bus. Tapping an OWNED upgrade card emits the upgrade id; the matching
// physical object in the 3D office (wall screen, coffee station, easel, test chamber…) reads a
// decaying intensity each frame and gives a little attention bob. Same fire-and-forget pattern as
// hqReaction — presentation only, no prop-drilling into the scene.
import type { UpgradeId } from "../engine/upgrades.ts";

export const HQ_HIGHLIGHT_MS = 1800;

let active: { id: UpgradeId; start: number } | null = null;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

export function emitHighlight(id: UpgradeId): void {
  active = { id, start: now() };
}

/** Decaying 0..1 intensity for `id` (0 when none / wrong id / elapsed). For r3f useFrame polling. */
export function highlightIntensity(id: UpgradeId): number {
  if (!active || active.id !== id) return 0;
  const p = (now() - active.start) / HQ_HIGHLIGHT_MS;
  return p >= 0 && p <= 1 ? 1 - p : 0;
}
