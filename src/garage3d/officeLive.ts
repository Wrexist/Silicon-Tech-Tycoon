// Living-office scheduling (Wave 7) — the tiny deterministic seam the 3D scene reads per frame.
//
// The office Canvas is memoized so the host re-rendering on every sim tick does NOT re-reconcile the
// whole R3F tree. The character state machine and the chatter scheduler still need the run's
// (seed, week), but threading those as props would re-render that tree every week. Instead the host
// publishes them here through `setOfficeLiveContext` and the scene reads them inside `useFrame`.
//
// These are PRESENTATION-ONLY: a derived hash of the deterministic (seed, week) — never
// `Math.random`, never the engine's sim RNG. The engine is untouched, so the determinism pin can
// never see any of this; the same week always resolves to the same pose and the same bubble.
let liveSeed = 0;
let liveWeek = 0;

export function setOfficeLiveContext(seed: number, week: number): void {
  liveSeed = seed >>> 0;
  liveWeek = week;
}

export function officeSeed(): number {
  return liveSeed;
}

export function officeWeek(): number {
  return liveWeek;
}

/** Tiny deterministic hash → [0,1). The same recipe the engine's derived-hash streams use
 *  (eureka / license offers / side orders), so a cosmetic stream looks and behaves like the real
 *  ones. UI-only: it never feeds the simulation. */
export function cosmeticHash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The per-character work state for THIS week: 0 = idle (sitting back, slow look-around), 1 =
 * working (leaning in, typing). A derived hash of (seed, week, character key) — salt 401, a fresh
 * cosmetic stream — so half the room is busy and half is calm, and which is which shifts week to
 * week. The same week always looks the same, so a screenshot pair a few weeks apart shows different
 * poses. `cheer` is NOT chosen here: it is layered on top from the existing celebration bus
 * (`reactionIntensity("cheer")`), so there is still exactly one cheer system.
 */
export function workTargetFor(seed: number, week: number, key: number): number {
  // Fold the character key into the seed so each person gets an independent stream (never a shared
  // one that would make the whole team snap together).
  const s = (seed ^ Math.imul((key + 1) >>> 0, 0x9e3779b1)) >>> 0;
  return cosmeticHash01(s, week, 401) < 0.6 ? 1 : 0;
}
