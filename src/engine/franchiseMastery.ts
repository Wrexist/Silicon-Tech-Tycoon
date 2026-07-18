// Franchise Mastery perks (FEATURES_RANKED #8) — a product LINE that grows deep AND beloved earns a
// permanent, NAMED boon for its future entries. Where Category Mastery (mastery.ts) rewards BREADTH
// (shipping across the ten categories), this rewards DEPTH: nursing one line to greatness. Both are
// derived ENTIRELY from the existing state.launched[] history (no new persisted counters), so they
// self-heal and can never drift out of sync.
//
// A line QUALIFIES when it has ≥5 entries AND has reached the top brand-equity tier ("Iconic", from
// franchise.ts). Qualifying grants ONE line-scoped boon — chosen deterministically from the line's
// dominant category — that applies only to FUTURE launches in that line. Deliberately flavour-forward
// and modest (at or below Category-Mastery magnitudes): the pull is the NAMED boon + the previewed
// countdown, not raw power, so this deepens the brand-equity chase without hardening "re-ship the
// winner". PURE — no GameState, no RNG.
import { brandEquity, brandEquityLabel, franchiseStem } from "./franchise.ts";
import type { CategoryId, LaunchedProduct } from "./types.ts";

/** Entries a line needs before it can qualify (the depth gate; the Iconic tier is the quality gate). */
export const FRANCHISE_MASTERY_MIN_ENTRIES = 5;

/** The three boon flavours. Each qualified line earns exactly one, keyed off its dominant category. */
export type FranchiseBoonId = "heritageHalo" | "trustedName" | "signatureCraft";

/** A line-scoped boon. Exactly ONE axis is non-zero per boon, so a boon reads as a single distinctive
 *  perk ("Heritage Halo → louder launches") rather than a grab-bag of +%s. Magnitudes are at or below
 *  the Category-Mastery L5 caps (hype ≤0.05→0.06, design +2→+1), so a boon is an edge, never an auto-win. */
export interface FranchiseBoon {
  id: FranchiseBoonId;
  name: string;
  blurb: string;
  hype: number;     // + fractional launch hype (anticipation for the next entry)
  preorder: number; // + fractional pre-order lift (loyal followers commit early)
  design: number;   // + design-appeal points on the shipped device
}

/** The all-zero boon — returned wherever a line hasn't qualified, so every seam is a byte-exact no-op. */
export const ZERO_FRANCHISE_BOON: FranchiseBoon = {
  id: "heritageHalo", name: "", blurb: "", hype: 0, preorder: 0, design: 0,
};

export const FRANCHISE_BOONS: Record<FranchiseBoonId, FranchiseBoon> = {
  heritageHalo: {
    id: "heritageHalo", name: "Heritage Halo",
    blurb: "A storied name — every new entry launches to a louder welcome (+6% hype).",
    hype: 0.06, preorder: 0, design: 0,
  },
  trustedName: {
    id: "trustedName", name: "Trusted Name",
    blurb: "Loyal followers commit sight-unseen — the line's launches pre-order stronger (+4%).",
    hype: 0, preorder: 0.04, design: 0,
  },
  signatureCraft: {
    id: "signatureCraft", name: "Signature Craft",
    blurb: "A house style refined over years — every entry ships with a touch more polish (+1 design).",
    hype: 0, preorder: 0, design: 1,
  },
};

/** Which boon a line earns, from its dominant category. Fixed mapping → same line → same boon, forever.
 *  Grouped by flavour: hype-led consumer lines get the Halo, productivity/repeat-buyer lines the Trusted
 *  Name, and craft/precision lines the Signature. */
const CATEGORY_BOON: Record<CategoryId, FranchiseBoonId> = {
  phone: "heritageHalo",
  console: "heritageHalo",
  wearable: "heritageHalo",
  tablet: "trustedName",
  laptop: "trustedName",
  robot: "trustedName",
  desktop: "signatureCraft",
  monitor: "signatureCraft",
  experimental: "signatureCraft",
  neuralband: "signatureCraft",
};

/** The boon a given category maps to (stable lookup). */
export function boonIdForCategory(cat: CategoryId): FranchiseBoonId {
  return CATEGORY_BOON[cat] ?? "heritageHalo";
}

/** Title-case a lowercase stem for display ("aurora" → "Aurora"). Mirrors franchise.ts. */
function displayName(stem: string): string {
  return stem.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The dominant (most-shipped) category across a line's entries. Ties break by first appearance, which
 *  is deterministic for a fixed launch history. Empty line → null. */
export function dominantCategory(line: readonly LaunchedProduct[]): CategoryId | null {
  const counts = new Map<CategoryId, number>();
  let best: CategoryId | null = null;
  let bestN = 0;
  for (const lp of line) {
    const c = lp?.product?.category as CategoryId | undefined;
    if (!c) continue;
    const n = (counts.get(c) ?? 0) + 1;
    counts.set(c, n);
    if (n > bestN) { bestN = n; best = c; }
  }
  return best;
}

/** Per-line mastery read. */
export interface FranchiseMasteryLine {
  stem: string;
  name: string;              // title-cased display name
  entries: number;           // actual launches in the line
  label: ReturnType<typeof brandEquityLabel>;
  iconic: boolean;           // has the line reached the top brand-equity tier?
  qualified: boolean;        // ≥ MIN_ENTRIES entries AND iconic
  /** Entries still needed to clear the depth gate (0 once at/over MIN_ENTRIES). The quality gate
   *  (Iconic) is reported separately via `iconic`. */
  remaining: number;
  dominantCategory: CategoryId | null;
  boon: FranchiseBoon;       // the boon this line earns (or would earn once qualified)
}

/** Build the per-line mastery read for ONE line's entries (already filtered to the stem). Pure. */
function lineMastery(stem: string, entries: readonly LaunchedProduct[]): FranchiseMasteryLine {
  const eq = brandEquity(entries, stem);
  const label = brandEquityLabel(eq);
  const iconic = label === "Iconic";
  const count = entries.length;
  const remaining = Math.max(0, FRANCHISE_MASTERY_MIN_ENTRIES - count);
  const dom = dominantCategory(entries);
  const boon = FRANCHISE_BOONS[boonIdForCategory(dom ?? "phone")];
  return {
    stem,
    name: displayName(stem),
    entries: count,
    label,
    iconic,
    qualified: count >= FRANCHISE_MASTERY_MIN_ENTRIES && iconic,
    remaining,
    dominantCategory: dom,
    boon,
  };
}

/** Full per-line franchise-mastery table for the whole launch history — one row per line, sorted by how
 *  CLOSE each line is to unlocking (qualified first, then by entries then equity), for the preview UI. */
export function franchiseMastery(launched: readonly LaunchedProduct[]): FranchiseMasteryLine[] {
  const byStem = new Map<string, LaunchedProduct[]>();
  for (const lp of launched) {
    const stem = franchiseStem(lp?.product?.name ?? "");
    if (!stem) continue;
    const arr = byStem.get(stem);
    if (arr) arr.push(lp);
    else byStem.set(stem, [lp]);
  }
  const out: FranchiseMasteryLine[] = [];
  for (const [stem, entries] of byStem) out.push(lineMastery(stem, entries));
  out.sort(
    (a, b) =>
      Number(b.qualified) - Number(a.qualified) ||
      b.entries - a.entries ||
      (b.iconic ? 1 : 0) - (a.iconic ? 1 : 0),
  );
  return out;
}

/** The mastery read for the ONE line a product name belongs to (single pass — the seams only need one
 *  line). Blank / stem-less name → null. */
export function franchiseMasteryForName(
  launched: readonly LaunchedProduct[],
  name: string,
): FranchiseMasteryLine | null {
  const stem = franchiseStem(name ?? "");
  if (!stem) return null;
  const entries = launched.filter((lp) => franchiseStem(lp?.product?.name ?? "") === stem);
  return lineMastery(stem, entries);
}

/** The boon a line has EARNED for its future launches, or the all-zero boon if it hasn't qualified.
 *  Pure over the launch history + the product's name (which fixes the line). The line is qualified from
 *  its PRIOR entries, so this is the boon a NEW entry in the line launches with. */
export function franchiseBoonForName(
  launched: readonly LaunchedProduct[],
  name: string,
): FranchiseBoon {
  const line = franchiseMasteryForName(launched, name);
  return line && line.qualified ? line.boon : ZERO_FRANCHISE_BOON;
}

/** The single line CLOSEST to unlocking that hasn't qualified yet — the Goals-Ledger candidate. Only
 *  lines with at least `minEntries` entries are considered (keeps the ledger uncluttered). Null if none. */
export function closestUnqualifiedLine(
  launched: readonly LaunchedProduct[],
  minEntries = 3,
): FranchiseMasteryLine | null {
  const unqualified = franchiseMastery(launched).filter((l) => !l.qualified && l.entries >= minEntries);
  if (unqualified.length === 0) return null;
  // Closest = fewest entries remaining to the depth gate, then already-Iconic (only the depth gate left),
  // then deepest. Deterministic ordering over a fixed history.
  unqualified.sort(
    (a, b) => a.remaining - b.remaining || (b.iconic ? 1 : 0) - (a.iconic ? 1 : 0) || b.entries - a.entries,
  );
  return unqualified[0];
}
