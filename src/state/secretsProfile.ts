// The Vault CODEX — the union of every dossier a founder has ever opened, across all companies.
//
// The run's `secretsFound` is per-company (a New Game+ re-seals every file and its boon must be
// earned again). This store is the other half of that deal: what you LEARNED is yours forever. A file
// in the codex shows its codename and its exact terms in every future run, even while it sits sealed
// and unearned — so a returning founder starts the next company already knowing what to hunt for,
// and the hunt is for the deed, not the information a second time.
//
// Separate localStorage key, native-mirrored, exactly like the other profile stores (achievements /
// legacy / scenarioStars / challengeBests / museum).
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.secrets.v1";

/** Dossier ids this founder has opened in any company, ever. */
export function getCodex(): string[] {
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

/** Merge ids into the lifetime codex (union). Returns true if anything new was added. */
export function mergeCodex(ids: readonly unknown[] | undefined): boolean {
  if (!ids || ids.length === 0) return false;
  const have = new Set(getCodex());
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
    /* ignore — a full/blocked store must never break play */
  }
  mirrorToNative(KEY, serialized);
  return true;
}
