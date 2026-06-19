// Scenario mastery — best star rating earned per scenario id. Profile-level progress that PERSISTS
// across companies/runs (separate from the game save), mirroring legacy.ts: scenario stars are
// hard-earned mastery, so they survive a New Game+ or a fresh start and are mirrored to native
// Preferences against WKWebView storage eviction.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.scenarioStars.v1";

export type ScenarioStars = Record<string, number>;

/** Read the full best-stars map. Tolerant of corrupt/missing data → empty map. */
export function getScenarioStars(): ScenarioStars {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ScenarioStars = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Math.max(0, Math.min(3, Math.round(Number(v))));
      if (Number.isFinite(n) && n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Best stars earned for one scenario (0 if never won). */
export function bestStars(id: string): number {
  return getScenarioStars()[id] ?? 0;
}

/** Record a star result for a scenario, keeping only the best ever. Returns whether it improved
 *  and the resulting best, so the caller can decide whether to celebrate. */
export function recordStars(id: string, stars: number): { improved: boolean; best: number } {
  const clamped = Math.max(0, Math.min(3, Math.round(stars)));
  const map = getScenarioStars();
  const prev = map[id] ?? 0;
  if (clamped <= prev) return { improved: false, best: prev };
  map[id] = clamped;
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
  return { improved: true, best: clamped };
}
