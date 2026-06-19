// Challenge personal bests — highest score per challenge (keyed `${kind}:${dateKey}`). Profile-level
// progress that PERSISTS across runs (separate from the game save), mirroring scenarioProgress.ts.
// No online leaderboard (no backend); this is the offline "beat your own history" substitute.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.challengeBests.v1";

export type ChallengeBests = Record<string, number>;

export function challengeKey(kind: string, dateKey: string): string {
  return `${kind}:${dateKey}`;
}

export function getChallengeBests(): ChallengeBests {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ChallengeBests = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function bestScore(key: string): number | null {
  const v = getChallengeBests()[key];
  return v == null ? null : v;
}

/** Bulk-restore (backup import). Merges with existing, keeping the higher score per key. */
export function mergeChallengeBests(incoming: unknown): void {
  if (!incoming || typeof incoming !== "object") return;
  const map = getChallengeBests();
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && (map[k] == null || n > map[k])) map[k] = n;
  }
  const serialized = JSON.stringify(map);
  try { localStorage.setItem(KEY, serialized); } catch { /* ignore */ }
  mirrorToNative(KEY, serialized);
}

/** Record a score for a challenge, keeping only the best. Returns whether it improved + the best. */
export function recordChallengeBest(key: string, score: number): { improved: boolean; best: number } {
  const s = Math.round(Number(score));
  const map = getChallengeBests();
  const prev = map[key];
  if (prev != null && s <= prev) return { improved: false, best: prev };
  map[key] = s;
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
  return { improved: true, best: s };
}
