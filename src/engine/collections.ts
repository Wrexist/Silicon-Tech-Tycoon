// Collection goals (item 5.2) — long-tail, cross-run "collect them all" objectives evaluated against
// the device MUSEUM (every device you've ever shipped, profile-level). Completing a collection is a
// permanent trophy — retention via collection, matching the museum's philosophy, NOT engagement
// farming. PURE + deterministic: reads a lightweight record of shipped devices, no game state, no RNG,
// so it never touches the sim. The Museum screen renders the progress + completed badges.
import { CATEGORIES } from "./catalogs.ts";
import { franchiseStem } from "./franchise.ts";
import type { CategoryId } from "./types.ts";

/** The minimal read of a shipped device a collection cares about (mapped from a MuseumEntry). */
export interface DeviceRecord {
  category: CategoryId;
  era: number;
  verdict?: string; // "hit" | "solid" | "flop" | "steady"
  name: string;
}

/** Aggregate facts derived once from the full museum, shared by every collection's evaluator. */
export interface CollectionFacts {
  total: number;
  categories: Set<CategoryId>;
  hitCount: number;
  erasShipped: Set<number>;
  hitEras: Set<number>;
  maxFranchiseDepth: number; // the longest same-stem sequel line
}

const ALL_CATEGORIES = Object.keys(CATEGORIES) as CategoryId[];
const ERA_COUNT = 4;

export function collectionFacts(devices: readonly DeviceRecord[]): CollectionFacts {
  const categories = new Set<CategoryId>();
  const erasShipped = new Set<number>();
  const hitEras = new Set<number>();
  const franchiseCounts = new Map<string, number>();
  let hitCount = 0;
  for (const d of devices) {
    categories.add(d.category);
    erasShipped.add(d.era);
    if (d.verdict === "hit") { hitCount++; hitEras.add(d.era); }
    const stem = franchiseStem(d.name);
    franchiseCounts.set(stem, (franchiseCounts.get(stem) ?? 0) + 1);
  }
  let maxFranchiseDepth = 0;
  for (const n of franchiseCounts.values()) maxFranchiseDepth = Math.max(maxFranchiseDepth, n);
  return { total: devices.length, categories, hitCount, erasShipped, hitEras, maxFranchiseDepth };
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  /** Current count against target, derived from the facts. */
  measure: (f: CollectionFacts) => number;
  target: number;
}

// The catalog — a mix of breadth (every category / every era), quality (hits), and depth (a franchise
// dynasty). Targets are read from the live tables so they can't drift out of sync.
export const COLLECTIONS: readonly Collection[] = [
  { id: "polymath", name: "The Polymath", description: "Ship a device in every product category.", measure: (f) => f.categories.size, target: ALL_CATEGORIES.length },
  { id: "hitmaker", name: "Hitmaker", description: "Ship 10 hit products across your career.", measure: (f) => f.hitCount, target: 10 },
  { id: "eraSpanner", name: "Across the Ages", description: "Ship a product in all four eras.", measure: (f) => f.erasShipped.size, target: ERA_COUNT },
  { id: "everHit", name: "Every Era a Hit", description: "Land at least one hit in each of the four eras.", measure: (f) => f.hitEras.size, target: ERA_COUNT },
  { id: "dynasty", name: "Dynasty", description: "Build a franchise five generations deep.", measure: (f) => f.maxFranchiseDepth, target: 5 },
  { id: "prolific", name: "Prolific", description: "Ship 25 devices into the museum.", measure: (f) => f.total, target: 25 },
];

export interface CollectionProgress {
  current: number;
  target: number;
  done: boolean;
  frac: number; // 0..1
}

export function collectionProgress(c: Collection, f: CollectionFacts): CollectionProgress {
  const current = Math.min(c.measure(f), c.target);
  return { current, target: c.target, done: current >= c.target, frac: c.target > 0 ? current / c.target : 1 };
}

/** How many collections are fully complete — the museum's headline "N/M collected". */
export function completedCollectionCount(f: CollectionFacts): number {
  return COLLECTIONS.filter((c) => collectionProgress(c, f).done).length;
}
