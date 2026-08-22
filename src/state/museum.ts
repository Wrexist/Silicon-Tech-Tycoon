// Device museum — a permanent, cross-run collection of every device you've shipped. Profile-level
// (separate from the game save), so your design legacy persists across New Game+ and restarts.
// Leans into the pillars: devices are parametric SVG ("the product is the toy", zero image assets),
// so the museum re-renders them from the stored Product with no assets. Retention via collection,
// not engagement-farming (RETENTION_ROADMAP §3, "new thinking").
import { mirrorToNative } from "./nativeStore.ts";
import type { CategoryId, LaunchInsight, Product } from "../engine/types.ts";

const KEY = "silicon.museum.v1";
const CAP = 60; // keep the most recent N shipped devices (bounds localStorage)

export interface MuseumEntry {
  key: string; // unique
  product: Product; // renderable via DeviceRenderer (zero assets)
  name: string;
  category: CategoryId;
  era: number;
  companyName: string;
  week: number;
  verdict?: string; // "hit" | "solid" | "flop" | "steady"
  // Launch-moment analytics snapshot (added later; optional so older entries still load). Powers the
  // museum device detail's "how it did / what went good or bad" breakdown without needing the live save.
  insight?: LaunchInsight;
  launchScore?: number;
  forecastUnits?: number; // projected lifetime volume at launch
}

// Parse cache — same pattern as challengeProgress.ts: keyed by the RAW stored string so external
// writes invalidate naturally and our own writes prime it. Entries are treated as immutable
// records; the cached array is frozen (and typed readonly) so a stray mutation attempt fails
// loudly in dev instead of silently corrupting the shared cache.
let cache: { raw: string; list: readonly MuseumEntry[] } | null = null;

export function getMuseum(): readonly MuseumEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  if (cache && cache.raw === raw) return cache.list;
  let out: readonly MuseumEntry[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Tolerant: keep only entries that can render AND have a string key (used for de-dup + list identity).
    const list = (parsed as MuseumEntry[]).filter(
      (e) => e && typeof e.key === "string" && e.key.length > 0 && e.product && e.category && typeof e.name === "string",
    );
    out = Object.freeze(list);
  } catch {
    return [];
  }
  cache = { raw, list: out };
  return out;
}

/** Bulk-restore from a backup. Merges incoming entries with existing (de-duped by key), newest
 *  preserved, capped. Tolerant of malformed payloads. */
export function mergeMuseum(incoming: unknown): void {
  if (!Array.isArray(incoming)) return;
  const valid = (incoming as MuseumEntry[]).filter((e) => e && e.product && e.category && typeof e.name === "string" && typeof e.key === "string");
  const seen = new Set<string>();
  const merged: MuseumEntry[] = [];
  for (const e of [...valid, ...getMuseum()]) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    merged.push(e);
  }
  const kept = merged.slice(0, CAP);
  const serialized = JSON.stringify(kept);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, list: Object.freeze(kept) };
  } catch {
    /* quota/eviction — leave the cache on the old raw so reads stay truthful */
  }
  mirrorToNative(KEY, serialized);
}

/** Add a freshly-shipped device to the museum (newest first, capped). De-dupes by key. */
export function addMuseumEntry(entry: MuseumEntry): void {
  const list = getMuseum().filter((e) => e.key !== entry.key);
  const next = [entry, ...list].slice(0, CAP);
  const serialized = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, serialized);
    cache = { raw: serialized, list: Object.freeze(next) };
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
}
