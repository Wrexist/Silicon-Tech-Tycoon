// Global expansion — geography as the growth axis (the "garage → global empire" fantasy). PURE.
//
// Today every product sells into one abstract market sized by category × era. This adds REGIONS: the
// player starts in their Home market and pays to expand into North America, Europe, Asia and Emerging
// markets. Each region has its own SIZE SHARE of the global market and its own TASTE (which of the
// five stats its buyers value), so expanding is a real strategic bet, not free upside — a product
// tuned for one region earns a bounded fit elsewhere ("who is this for?" extended to geography).
//
// Additive + non-invasive by design: this is a single multiplicative layer on `marketSize` in
// planProduction. A HOME-ONLY launch computes a reach of exactly 1.0, so existing/old-save play is
// bit-for-bit unchanged — the entire market.ts / scoreLaunch / salesCurve machinery is untouched.
import { BALANCE } from "./balance.ts";
import { regionShockMul } from "./climate.ts";
import { dollars, type Money } from "./money.ts";
import { STAT_KEYS, type RegionId, type Stats, type StatKey } from "./types.ts";

export interface Region {
  id: RegionId;
  name: string;
  blurb: string;
  /** Size of this region's addressable market RELATIVE to Home (Home = 1.0, the baseline anchor). */
  share: number;
  /** Raw taste weights over the five stats (normalized at use; relative magnitudes are what matter).
   *  Home is flat — your domestic market always "fits" (its tasteFit is pinned to 1.0). */
  weights: Stats;
  /** Cash to unlock distribution into this region. Home is free (always unlocked). */
  unlockCost: Money;
}

/** Region catalog. Shares + tastes are deliberately distinct so no single build wins every market:
 *  NA leans performance/ecosystem, Europe leans quality/design, Asia is the largest and leans
 *  performance/design/battery, Emerging is value-and-endurance led. Costs rise with opportunity. */
export const REGIONS: readonly Region[] = [
  {
    id: "home",
    name: "Home Market",
    blurb: "Your domestic base. Always open, and always a fit for what you build.",
    share: 1.0,
    weights: { performance: 1, quality: 1, battery: 1, design: 1, ecosystem: 1 },
    unlockCost: dollars(0),
  },
  {
    id: "north_america",
    name: "North America",
    blurb: "Big spenders who chase raw performance and a tight ecosystem.",
    share: 0.9,
    weights: { performance: 1.3, quality: 1.0, battery: 0.8, design: 1.0, ecosystem: 1.2 },
    unlockCost: dollars(40_000),
  },
  {
    id: "europe",
    name: "Europe",
    blurb: "Discerning buyers who reward build quality and refined design.",
    share: 0.75,
    weights: { performance: 0.9, quality: 1.3, battery: 0.9, design: 1.3, ecosystem: 1.0 },
    unlockCost: dollars(75_000),
  },
  {
    id: "asia",
    name: "Asia",
    blurb: "The largest market, fast-moving, design-aware and performance-hungry.",
    share: 1.15,
    weights: { performance: 1.2, quality: 1.0, battery: 1.1, design: 1.2, ecosystem: 0.9 },
    unlockCost: dollars(150_000),
  },
  {
    id: "emerging",
    name: "Emerging Markets",
    blurb: "Huge volume for durable, long-lasting value, design matters less here.",
    share: 0.85,
    weights: { performance: 1.0, quality: 1.2, battery: 1.3, design: 0.7, ecosystem: 0.8 },
    unlockCost: dollars(110_000),
  },
];

export function regionById(id: RegionId): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

/** Item 5.7 — the stat a region weights most (its buying TASTE), lower-cased for flavor prose. Drives
 *  region-specific event copy ("this design-led market…"). Pure; ties to the same weights that size a
 *  launch's regional reach, so the flavor can never drift from the mechanics. */
const STAT_TASTE: Record<string, string> = {
  performance: "performance-hungry", quality: "quality-conscious", battery: "endurance-focused",
  design: "design-led", ecosystem: "ecosystem-driven",
};
export function regionTasteLabel(id: RegionId): string {
  const r = regionById(id);
  if (!r) return "";
  const entries = Object.entries(r.weights);
  let topKey = entries[0][0];
  let topVal = -Infinity;
  for (const [k, v] of entries) if (v > topVal) { topVal = v; topKey = k; }
  // Flat-taste markets (Home, weights all equal) have no standout → no taste label.
  const atTop = entries.filter(([, v]) => v >= topVal - 1e-9).length;
  if (atTop === entries.length) return "";
  return STAT_TASTE[topKey] ?? "";
}

/** A region's slice of the total world market (0..1) — "how big" it is, for the UI. */
export function regionWorldShare(region: Region): number {
  const total = REGIONS.reduce((a, r) => a + r.share, 0);
  return total > 0 ? region.share / total : 0;
}

/** Share of the world market the player currently reaches (Σ open region shares ÷ total). Drives the
 *  "global reach" empire meter — 100% once every market is licensed. */
export function worldCoverage(unlocked: readonly RegionId[]): number {
  const total = REGIONS.reduce((a, r) => a + r.share, 0);
  const open = REGIONS.reduce((a, r) => a + (unlocked.includes(r.id) ? r.share : 0), 0);
  return total > 0 ? open / total : 0;
}

/** The stats a region's buyers value most (top-n by taste weight); [] for Home (flat taste). Lets the
 *  UI say "Europe values Quality · Design" so expanding is a legible strategic bet, not a blind buy. */
export function regionTasteTop(region: Region, n = 2): StatKey[] {
  if (region.id === "home") return [];
  return [...STAT_KEYS].sort((a, b) => region.weights[b] - region.weights[a]).slice(0, n);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function normalize(w: Stats): Stats {
  let total = 0;
  for (const k of STAT_KEYS) total += Math.max(0, w[k]);
  if (total <= 0) {
    const eq = 1 / STAT_KEYS.length;
    return { performance: eq, quality: eq, battery: eq, design: eq, ecosystem: eq };
  }
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = Math.max(0, w[k]) / total;
  return out;
}

/** How well a product's stats suit a region's taste, as a bounded multiplier around 1.0. It compares
 *  the product's region-weighted stat average to its plain average — a flat product scores 1.0, a
 *  product strong where the region cares scores up to `fitMax`, weak there down to `fitMin`. Because
 *  it's a RATIO of stats it's era-independent (specs grow, the fit doesn't drift). Home is pinned to
 *  1.0 so a home-only launch is never altered. */
export function regionTasteFit(stats: Stats, region: Region): number {
  if (region.id === "home") return 1.0;
  const cfg = BALANCE.market.regions;
  const w = normalize(region.weights);
  let weighted = 0;
  let plain = 0;
  for (const k of STAT_KEYS) {
    weighted += w[k] * stats[k];
    plain += stats[k] / STAT_KEYS.length;
  }
  if (plain <= 0) return 1.0;
  const ratio = weighted / plain; // ~1 for a balanced product
  const fit = 1 + (ratio - 1) * cfg.tasteSpread;
  return clamp(fit, cfg.fitMin, cfg.fitMax);
}

/** The set of regions a product actually ships to: its chosen regions intersected with what's been
 *  unlocked, defaulting to Home (so a missing/empty selection never zeroes out demand). */
export function shippableRegions(
  unlocked: readonly RegionId[],
  chosen: readonly RegionId[] | undefined,
): RegionId[] {
  const unlockedSet = new Set(unlocked.length ? unlocked : ["home"]);
  const out = (chosen ?? ["home"]).filter((id) => unlockedSet.has(id) && regionById(id));
  return out.length ? out : ["home"];
}

/** A region's reach MULTIPLIER from your standing there (regional loyalty, moved by regional events).
 *  Neutral/missing loyalty (and Home) → exactly 1.0, so a home-only company is never affected. */
export function regionLoyaltyMul(loyalty: number | undefined): number {
  const cfg = BALANCE.market.regions.loyalty;
  if (!loyalty || !Number.isFinite(loyalty)) return 1;
  const v = clamp(loyalty, -cfg.cap, cfg.cap);
  return 1 + (v / cfg.cap) * cfg.maxSwing;
}

/** The market-size MULTIPLIER for a launch: Σ over shipped regions of (share × tasteFit). Home alone
 *  is exactly 1.0 (no regression); each added region grows the addressable market by its share,
 *  modulated by how well the product fits that region's taste. */
export function regionReach(
  unlocked: readonly RegionId[],
  chosen: readonly RegionId[] | undefined,
  stats: Stats,
  /** Track B — current week, to apply periodic regional crises (engine/climate.ts). Omitted → no
   *  shock, and Home is never shocked anyway, so a domestic launch and old saves are byte-identical. */
  week?: number,
  /** Per-region loyalty (regional events). Omitted/empty → every multiplier is 1.0 → unchanged. Home
   *  is never keyed, so a home-only launch is byte-identical. */
  loyalty?: Partial<Record<RegionId, number>>,
): number {
  const ships = shippableRegions(unlocked, chosen);
  let reach = 0;
  for (const id of ships) {
    const r = regionById(id)!;
    const shock = week === undefined ? 1 : regionShockMul(id, week);
    const loyal = id === "home" ? 1 : regionLoyaltyMul(loyalty?.[id]);
    reach += r.share * regionTasteFit(stats, r) * shock * loyal;
  }
  return reach;
}
