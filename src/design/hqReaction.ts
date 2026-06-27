// HQ "living office" reaction bus. A launch outcome fires emitHqReaction("cheer"|"slump"); the team
// in the office (2D IsoScene via React subscription, 3D Garage3D via useFrame polling) reacts for a
// couple of seconds. Module singleton, same fire-and-forget pattern as celebrateFx — and it exposes a
// pollable progress so r3f characters can read it each frame without prop-drilling through the scene.
export type HqReaction = "cheer" | "slump";

export const HQ_REACTION_MS = 2600;

type Listener = (k: HqReaction) => void;
const listeners = new Set<Listener>();
let active: { kind: HqReaction; start: number } | null = null;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

export function onHqReaction(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitHqReaction(kind: HqReaction): void {
  active = { kind, start: now() };
  listeners.forEach((fn) => fn(kind));
}

/** Decaying 0..1 intensity of an active reaction of `kind` (0 when none / wrong kind / elapsed).
 *  Presentation-only (performance.now, not the sim clock) — safe for r3f useFrame polling. */
export function reactionIntensity(kind: HqReaction): number {
  if (!active || active.kind !== kind) return 0;
  const p = (now() - active.start) / HQ_REACTION_MS;
  return p >= 0 && p <= 1 ? 1 - p : 0;
}
