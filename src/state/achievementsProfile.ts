// Profile-level achievements — the UNION of every milestone earned across all companies. The game
// save's `unlockedAchievements` is per-run (resets on New Game+/restart); this store accumulates
// them for good, so the Achievements wall reflects a lifetime of play. Separate localStorage key,
// native-mirrored, like the other profile stores (legacy / scenarioStars / challengeBests / museum).
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.achievements.v1";

export function getProfileAchievements(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Merge ids into the lifetime set (union). Returns true if anything new was added. */
export function mergeProfileAchievements(ids: readonly unknown[] | undefined): boolean {
  if (!ids || ids.length === 0) return false;
  const have = new Set(getProfileAchievements());
  let changed = false;
  for (const id of ids) {
    if (typeof id === "string" && !have.has(id)) {
      have.add(id);
      changed = true;
    }
  }
  if (!changed) return false;
  const serialized = JSON.stringify([...have]);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
  return true;
}
