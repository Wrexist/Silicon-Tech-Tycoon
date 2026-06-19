// Device museum — a permanent, cross-run collection of every device you've shipped. Profile-level
// (separate from the game save), so your design legacy persists across New Game+ and restarts.
// Leans into the pillars: devices are parametric SVG ("the product is the toy", zero image assets),
// so the museum re-renders them from the stored Product with no assets. Retention via collection,
// not engagement-farming (RETENTION_ROADMAP §3, "new thinking").
import { mirrorToNative } from "./nativeStore.ts";
import type { CategoryId, Product } from "../engine/types.ts";

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
}

export function getMuseum(): MuseumEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Tolerant: keep only entries that can render AND have a string key (used for de-dup + list identity).
    return (parsed as MuseumEntry[]).filter(
      (e) => e && typeof e.key === "string" && e.key.length > 0 && e.product && e.category && typeof e.name === "string",
    );
  } catch {
    return [];
  }
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
  const serialized = JSON.stringify(merged.slice(0, CAP));
  try { localStorage.setItem(KEY, serialized); } catch { /* ignore */ }
  mirrorToNative(KEY, serialized);
}

/** Add a freshly-shipped device to the museum (newest first, capped). De-dupes by key. */
export function addMuseumEntry(entry: MuseumEntry): void {
  const list = getMuseum().filter((e) => e.key !== entry.key);
  const next = [entry, ...list].slice(0, CAP);
  const serialized = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
}
