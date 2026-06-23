// Product franchises / brand equity (the "IP & fanbase" lever — MGT2 [STEAL]). PURE.
//
// The game already names sequels in a series ("Aurora One" → "Aurora Two", naming.ts). This turns a
// product LINE into a real strategic asset: a line's track record builds BRAND EQUITY, and a proven
// series launches with an advantage — loyal followers pre-order more, and a strong name carries
// anticipation. A flop tarnishes the line; letting it lapse lets equity fade (recency-weighted). So
// "build and protect a flagship line" becomes a genuine long-game decision, distinct from (and
// complementary to) the self-cannibalization of relaunching into the same category.
//
// First-in-line products have no history → zero equity → zero bonus, so this is purely additive and
// never changes a fresh launch. Bounded throughout: a beloved line is an edge, never an auto-win.
import { BALANCE } from "./balance.ts";
import { sum, type Money } from "./money.ts";
import type { CategoryId, LaunchedProduct } from "./types.ts";

const NUM_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
]);

function isRomanish(s: string): boolean {
  return s.length > 0 && /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i.test(s);
}

/** The line a product belongs to: its name with the trailing series token (digits / number-word /
 *  Roman numeral) stripped, lowercased. "Aurora One" / "Aurora 2" / "Aurora II" → "aurora". A name
 *  with no series token is its own line ("Nova" → "nova"). Empty for a blank name. */
export function franchiseStem(name: string): string {
  let n = (name ?? "").trim();
  if (!n) return "";
  n = n.replace(/\s*\d+\s*$/i, "").trim(); // trailing digits (e.g. "Aurora 2")
  const parts = n.split(/\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    if (NUM_WORDS.has(last) || isRomanish(last)) parts.pop();
  }
  return parts.join(" ").toLowerCase();
}

export interface BrandEquity {
  stem: string;
  /** Number of prior launches counted in the line (recency-capped). */
  entries: number;
  /** −1..1 — the line's standing: a record of hits → strong; a recent flop → tarnished. */
  equity: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Compute a line's brand equity from its prior launches (newest first — `launched` is prepended on
 *  launch). Each prior launch contributes by its verdict, weighted down by how far back it sits
 *  (recencyDecay), summed and clamped. Pure. */
export function brandEquity(launched: readonly LaunchedProduct[], stem: string): BrandEquity {
  if (!stem) return { stem: "", entries: 0, equity: 0 };
  const f = BALANCE.franchise;
  const line = launched.filter((lp) => franchiseStem(lp.product.name) === stem).slice(0, f.maxEntries);
  let acc = 0;
  line.forEach((lp, i) => {
    const v = lp.verdict ?? "steady";
    acc += Math.pow(f.recencyDecay, i) * (f.verdictEquity[v] ?? 0);
  });
  return { stem, entries: line.length, equity: clamp(acc, -1, 1) };
}

/** Fraction to lift pre-orders by for this line (0 when the brand isn't positive). */
export function equityPreorderBonus(equity: number): number {
  return Math.max(0, equity) * BALANCE.franchise.preorderBonusMax;
}

/** Launch-hype to add for this line's anticipation (0 when the brand isn't positive). */
export function equityHypeBonus(equity: number): number {
  return Math.max(0, equity) * BALANCE.franchise.hypeBonusMax;
}

/** Plain-language standing for the UI. */
export function brandEquityLabel(b: BrandEquity): "New line" | "Tarnished" | "Building" | "Established" | "Iconic" {
  if (b.entries === 0) return "New line";
  if (b.equity < 0) return "Tarnished";
  if (b.equity < 0.25) return "Building";
  if (b.equity < 0.6) return "Established";
  return "Iconic";
}

/** Title-case a lowercase stem for display ("aurora" → "Aurora"). */
export function franchiseDisplayName(stem: string): string {
  return stem.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------- Overview aggregation (the Franchises screen + rival profiles) ----------

export interface FranchiseSummary {
  stem: string;
  name: string;            // title-cased display name of the line
  entries: number;         // launches in the line
  equity: number;          // -1..1 brand equity
  label: ReturnType<typeof brandEquityLabel>;
  unitsSold: number;       // total units across the line
  revenue: Money;          // total revenue earned across the line
  latestName: string;      // most recent product in the line
  latestWeek: number;
  categories: CategoryId[]; // distinct categories the line spans
}

/** Group the player's launched products into their franchises (lines), newest-launch first within
 *  each, sorted by depth then brand strength. Pure. */
export function playerFranchises(launched: readonly LaunchedProduct[]): FranchiseSummary[] {
  const byStem = new Map<string, LaunchedProduct[]>();
  for (const lp of launched) {
    const stem = franchiseStem(lp.product.name);
    if (!stem) continue;
    const arr = byStem.get(stem);
    if (arr) arr.push(lp);
    else byStem.set(stem, [lp]);
  }
  const out: FranchiseSummary[] = [];
  for (const [stem, lps] of byStem) {
    const eq = brandEquity(lps, stem);
    const latest = lps.reduce((a, b) => (b.launchedWeek > a.launchedWeek ? b : a));
    out.push({
      stem,
      name: franchiseDisplayName(stem),
      entries: lps.length,
      equity: eq.equity,
      label: brandEquityLabel(eq),
      unitsSold: lps.reduce((a, b) => a + b.unitsSold, 0),
      revenue: sum(lps.map((l) => l.revenueToDate)),
      latestName: latest.product.name,
      latestWeek: latest.launchedWeek,
      categories: [...new Set(lps.map((l) => l.product.category))],
    });
  }
  out.sort((a, b) => b.entries - a.entries || b.equity - a.equity);
  return out;
}

export interface RivalLineSummary {
  stem: string;
  name: string;
  entries: number;
  latestName: string;
  latestWeek: number;
  avgOverall: number;       // mean perceived quality across the line (display proxy)
  categories: CategoryId[];
}

/** Group a rival's releases into their product lines (no player-style verdicts → no equity score,
 *  just the line's depth + average quality). Pure; accepts the minimal shape a RivalRelease provides. */
export function rivalLines(
  items: readonly { name: string; week: number; overall: number; category: CategoryId }[],
): RivalLineSummary[] {
  const byStem = new Map<string, typeof items[number][]>();
  for (const it of items) {
    const stem = franchiseStem(it.name);
    if (!stem) continue;
    const arr = byStem.get(stem);
    if (arr) arr.push(it);
    else byStem.set(stem, [it]);
  }
  const out: RivalLineSummary[] = [];
  for (const [stem, list] of byStem) {
    const latest = list.reduce((a, b) => (b.week > a.week ? b : a));
    out.push({
      stem,
      name: franchiseDisplayName(stem),
      entries: list.length,
      latestName: latest.name,
      latestWeek: latest.week,
      avgOverall: Math.round(list.reduce((a, b) => a + b.overall, 0) / list.length),
      categories: [...new Set(list.map((l) => l.category))],
    });
  }
  out.sort((a, b) => b.entries - a.entries || b.latestWeek - a.latestWeek);
  return out;
}
