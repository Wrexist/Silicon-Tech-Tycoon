// Challenge personal bests — highest score per challenge (keyed `${kind}:${dateKey}`). Profile-level
// progress that PERSISTS across runs (separate from the game save), mirroring scenarioProgress.ts.
// No online leaderboard (no backend); this is the offline "beat your own history" substitute.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.challengeBests.v1";

export type ChallengeBests = Record<string, number>;

export function challengeKey(kind: string, dateKey: string): string {
  return `${kind}:${dateKey}`;
}

// Parse cache. HQ's ChallengeTracker re-reads bests every tick, so each render used to pay a
// localStorage.getItem + JSON.parse. Keyed by the RAW stored string: an external write (another
// tab, a backup import) changes it and invalidates naturally; our own writes prime it. The cached
// map is frozen — every writer clones before mutating, and a reader that tried would fail loudly in
// dev instead of silently corrupting the shared cache.
let cache: { raw: string; map: ChallengeBests } | null = null;

export function getChallengeBests(): ChallengeBests {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  if (cache && cache.raw === raw) return cache.map;
  let out: ChallengeBests = {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const map: ChallengeBests = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) map[k] = n;
    }
    out = Object.freeze(map);
  } catch {
    return {};
  }
  cache = { raw, map: out };
  return out;
}

export function bestScore(key: string): number | null {
  const v = getChallengeBests()[key];
  return v == null ? null : v;
}

export interface ChallengeHistoryEntry {
  kind: "daily" | "weekly";
  dateKey: string;
  score: number;
}

/** Every recorded challenge result, newest first — the offline "beat your own history" record.
 *  Keys are `${kind}:${dateKey}`; each challenge's goal is re-derivable from its date, so callers
 *  only need kind+dateKey+score here. */
export function challengeHistory(): ChallengeHistoryEntry[] {
  const out: ChallengeHistoryEntry[] = [];
  for (const [key, score] of Object.entries(getChallengeBests())) {
    const sep = key.indexOf(":");
    if (sep < 0) continue;
    const kind = key.slice(0, sep);
    const dateKey = key.slice(sep + 1);
    if ((kind === "daily" || kind === "weekly") && dateKey) out.push({ kind, dateKey, score });
  }
  // Newest date first; daily before weekly on the same date for a stable order.
  out.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : a.kind.localeCompare(b.kind)));
  return out;
}

/** Bulk-restore (backup import). Merges with existing, keeping the higher score per key. */
export function mergeChallengeBests(incoming: unknown): void {
  if (!incoming || typeof incoming !== "object") return;
  const map = { ...getChallengeBests() }; // clone: the getter may return the shared cached map
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && (map[k] == null || n > map[k])) map[k] = n;
  }
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, map: Object.freeze(map) }; // we know exactly what's stored now
  } catch {
    /* quota/eviction — leave the cache on the old raw so reads stay truthful */
  }
  mirrorToNative(KEY, serialized);
}

/** Record a score for a challenge, keeping only the best. Returns whether it improved + the best. */
export function recordChallengeBest(key: string, score: number): { improved: boolean; best: number } {
  const s = Math.round(Number(score));
  // Never persist a non-finite score: it serializes to null and rehydrates as 0, corrupting bests.
  if (!Number.isFinite(s)) return { improved: false, best: bestScore(key) ?? 0 };
  const map = { ...getChallengeBests() }; // clone: the getter may return the shared cached map
  const prev = map[key];
  if (prev != null && s <= prev) return { improved: false, best: prev };
  map[key] = s;
  const serialized = JSON.stringify(map);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, map: Object.freeze(map) }; // we know exactly what's stored now
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
  return { improved: true, best: s };
}
