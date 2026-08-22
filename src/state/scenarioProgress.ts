// Scenario mastery — best star rating earned per scenario id. Profile-level progress that PERSISTS
// across companies/runs (separate from the game save), mirroring legacy.ts: scenario stars are
// hard-earned mastery, so they survive a New Game+ or a fresh start and are mirrored to native
// Preferences against WKWebView storage eviction.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.scenarioStars.v1";

export type ScenarioStars = Record<string, number>;

// Parse cache — same pattern as challengeProgress.ts: keyed by the RAW stored string so external
// writes invalidate naturally, our own writes prime it, and the shared map is frozen (writers clone).
let cache: { raw: string; map: ScenarioStars } | null = null;

/** Read the full best-stars map. Tolerant of corrupt/missing data → empty map. */
export function getScenarioStars(): ScenarioStars {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  if (cache && cache.raw === raw) return cache.map;
  let out: ScenarioStars = {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const map: ScenarioStars = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Math.max(0, Math.min(3, Math.round(Number(v))));
      if (Number.isFinite(n) && n > 0) map[id] = n;
    }
    out = Object.freeze(map);
  } catch {
    return {};
  }
  cache = { raw, map: out };
  return out;
}

/** Best stars earned for one scenario (0 if never won). */
export function bestStars(id: string): number {
  return getScenarioStars()[id] ?? 0;
}

/** Bulk-restore the whole map (used by backup import). Merges with existing, keeping the best. */
export function mergeScenarioStars(incoming: unknown): void {
  if (!incoming || typeof incoming !== "object") return;
  const map = { ...getScenarioStars() }; // clone: the getter may return the shared cached map
  for (const [id, v] of Object.entries(incoming as Record<string, unknown>)) {
    const n = Math.max(0, Math.min(3, Math.round(Number(v))));
    if (Number.isFinite(n) && n > (map[id] ?? 0)) map[id] = n;
  }
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, map: Object.freeze(map) };
  } catch {
    /* quota/eviction — leave the cache on the old raw so reads stay truthful */
  }
  mirrorToNative(KEY, serialized);
}

/** Record a star result for a scenario, keeping only the best ever. Returns whether it improved
 *  and the resulting best, so the caller can decide whether to celebrate. */
export function recordStars(id: string, stars: number): { improved: boolean; best: number } {
  const clamped = Math.max(0, Math.min(3, Math.round(stars)));
  const map = { ...getScenarioStars() }; // clone: the getter may return the shared cached map
  const prev = map[id] ?? 0;
  if (clamped <= prev) return { improved: false, best: prev };
  map[id] = clamped;
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, map: Object.freeze(map) };
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
  return { improved: true, best: clamped };
}
