// Market segments — the demand model's new second axis (Epic A). PURE.
//
// Today's market scores a launch against ONE global trend vector (market.ts demandScore). That makes
// positioning a single-axis optimization — the seed of the genre's "solved recipe" failure (Game Dev
// Tycoon, Mad Games Tycoon). Here the market is split into BUYER SEGMENTS, each weighting the five
// stats AND price differently. A product captures a SHARE OF EACH SEGMENT, summed — so "who is this
// for?" is the core strategic question and the same specs play differently across segments.
//
// This module is additive and self-contained: it reuses the calibrated price constants + the global
// trend so trend-drift still matters, and exposes both the per-segment breakdown (for the readable
// verdict, pillar #5) and the two aggregates planProduction needs (demandIndex + effectivePriceFit).
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import { segmentSizeMul } from "./climate.ts";
import { toDollars, type Money } from "./money.ts";
import { STAT_KEYS, type CategoryId, type ConsumerTrends, type SegmentId, type Stats } from "./types.ts";

export type { SegmentId };

export interface Segment {
  id: SegmentId;
  name: string;
  blurb: string;
  /** Raw taste weights over the five stats (normalized at use; relative magnitudes are what matter). */
  weights: Stats;
  /** Price elasticity: >1 = very price-sensitive (Budget), <1 = price-insensitive (Pro/Enterprise). */
  priceSensitivity: number;
  /** Relative share of a category's market. The five sizes sum to ~1. */
  size: number;
  /** D1: how much this segment values a COHERENT build (no weak link). 0 = ignores lopsidedness (Pro
   *  bought the peak); 1 = fully discounts a lopsided build. Scales the global coherenceStrength. */
  coherencePref: number;
}

/** The five buyer segments. Identities are deliberately distinct so no single build wins them all:
 *  Budget chases value, Pro chases power, Style chases design, Enterprise chases ecosystem/reliability,
 *  Mainstream wants a balanced all-rounder. (Sizes sum to 1.00.) */
export const SEGMENTS: readonly Segment[] = [
  {
    id: "budget",
    name: "Budget",
    blurb: "Price-led buyers who want the essentials cheap.",
    weights: { performance: 0.9, quality: 1.0, battery: 1.2, design: 0.5, ecosystem: 0.5 },
    priceSensitivity: 1.7,
    size: 0.30,
    coherencePref: 0.6,
  },
  {
    id: "mainstream",
    name: "Mainstream",
    blurb: "The broad middle, a balanced, dependable all-rounder.",
    weights: { performance: 1.0, quality: 1.0, battery: 1.0, design: 0.9, ecosystem: 0.9 },
    priceSensitivity: 1.0,
    size: 0.32,
    coherencePref: 0.9,
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Power users who pay for raw performance and capability.",
    weights: { performance: 1.4, quality: 1.2, battery: 0.9, design: 0.8, ecosystem: 1.1 },
    priceSensitivity: 0.6,
    size: 0.15,
    coherencePref: 0.1,
  },
  {
    id: "style",
    name: "Style",
    blurb: "Design- and brand-led buyers who want the prettiest thing.",
    weights: { performance: 0.7, quality: 1.0, battery: 0.7, design: 1.6, ecosystem: 1.0 },
    priceSensitivity: 0.75,
    size: 0.14,
    coherencePref: 0.5,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Fleet buyers who value ecosystem, reliability and support.",
    weights: { performance: 0.9, quality: 1.3, battery: 1.1, design: 0.6, ecosystem: 1.5 },
    priceSensitivity: 0.55,
    size: 0.09,
    coherencePref: 0.9,
  },
];

export function segmentById(id: SegmentId): Segment | undefined {
  return SEGMENTS.find((s) => s.id === id);
}

/** Category-specific buyer mixes (Track D): the SAME recipe shouldn't win everywhere. Each category
 *  weights the five segments differently — a wearable is Style-led, a desktop/AR rig is Pro-led, a
 *  console is value-and-style, a laptop leans Pro+Enterprise. Each row sums to 1.00. Phone (and any
 *  category not listed) keeps the default global sizes, so the core phone loop + the sim are unchanged. */
const CATEGORY_MIX: Partial<Record<CategoryId, Partial<Record<SegmentId, number>>>> = {
  tablet: { budget: 0.26, mainstream: 0.34, pro: 0.14, style: 0.18, enterprise: 0.08 },
  laptop: { budget: 0.18, mainstream: 0.30, pro: 0.26, style: 0.10, enterprise: 0.16 },
  desktop: { budget: 0.14, mainstream: 0.24, pro: 0.35, style: 0.07, enterprise: 0.20 },
  monitor: { budget: 0.22, mainstream: 0.34, pro: 0.26, style: 0.10, enterprise: 0.08 },
  console: { budget: 0.34, mainstream: 0.34, pro: 0.16, style: 0.14, enterprise: 0.02 },
  wearable: { budget: 0.22, mainstream: 0.26, pro: 0.12, style: 0.35, enterprise: 0.05 },
  experimental: { budget: 0.10, mainstream: 0.22, pro: 0.34, style: 0.24, enterprise: 0.10 },
};

/** A segment's base share of a CATEGORY's market (Track D). Falls back to the default global size for
 *  phone and any category without an override. */
export function categorySegmentSize(category: CategoryId, seg: Segment): number {
  const mix = CATEGORY_MIX[category];
  const v = mix?.[seg.id];
  return v === undefined ? seg.size : v;
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

/** A segment's effective taste: its own weights, modulated by the category emphasis AND tilted toward
 *  the drifting global trend (so trend-drift still moves demand). trends.weights[k] is ~1/5 when flat;
 *  ×STAT_KEYS.length re-centers it at 1, then trendInfluence lerps how far the trend pulls. */
export function segmentEffectiveWeights(
  seg: Segment,
  category: CategoryId,
  trends: ConsumerTrends,
): Stats {
  const ti = BALANCE.market.segments.trendInfluence;
  const emphasis = CATEGORIES[category].statEmphasis;
  const raw = {} as Stats;
  for (const k of STAT_KEYS) {
    const trendTilt = (1 - ti) + ti * Math.max(0, trends.weights[k] * STAT_KEYS.length);
    raw[k] = Math.max(0, seg.weights[k]) * (emphasis[k] ?? 0.7) * trendTilt;
  }
  return normalize(raw);
}

/** 0..100 — how well a product's stats match what THIS segment wants right now. */
export function segmentFit(
  stats: Stats,
  seg: Segment,
  category: CategoryId,
  trends: ConsumerTrends,
): number {
  const w = segmentEffectiveWeights(seg, category, trends);
  let acc = 0;
  for (const k of STAT_KEYS) acc += w[k] * stats[k];
  return acc;
}

/** 0..maxFit — how fair this segment finds the price, given how much it values the product (`fit`).
 *  The fair price is the segment's own perceived value × the global value-to-price scale. A
 *  price-sensitive segment has a NARROWER tolerance (deviation bites harder) and rewards a bargain
 *  more; an insensitive segment barely reacts to price at all. Mirrors market.priceFit's asymmetry
 *  (overpricing punished harder than underpricing) so the two models read consistently. */
export function segmentPriceFit(price: Money, fit: number, seg: Segment): number {
  const p = BALANCE.market.price;
  const fairDollars = Math.max(1, fit * toDollars(p.valueToPrice));
  const ratio = toDollars(price) / fairDollars;
  // Sensitive segments have a tighter pricing band (floored so it's never a knife-edge).
  const tol = Math.max(BALANCE.market.segments.minPriceTolerance, p.tolerance / seg.priceSensitivity);
  let dev = ratio - 1;
  if (dev > 0) dev *= p.overpriceHarshness; // overpricing always hurts more than underpricing
  const fitCurve = Math.exp(-(dev * dev) / (2 * tol * tol));
  // A bargain pleases price-sensitive segments more (scaled by sensitivity); negligible for Pro.
  const underBoost = ratio < 1 ? (1 - ratio) * 0.25 * seg.priceSensitivity : 0;
  return clamp(fitCurve + underBoost, 0, p.maxFit);
}

export interface SegmentResult {
  id: SegmentId;
  name: string;
  size: number;
  fit: number; // 0..100 stat match
  priceFit: number; // 0..maxFit price fairness for this segment
  captured: number; // size × (fit/100) × priceFit — share of this segment the product wins
}

export interface SegmentDemand {
  perSegment: SegmentResult[];
  /** Σ size×fit (0..100) — the segment-weighted demand fit, the drop-in analog of demandScore. */
  demandIndex: number;
  /** Σ size×(fit/100)×priceFit (0..~1) — demand after each segment's price reaction. */
  priceWeighted: number;
  /** priceWeighted re-expressed as a 0..maxFit multiplier (priceWeighted ÷ demandIndex/100), so it
   *  drops into the existing `demand × hype × priceFit × …` launch-score shape unchanged. */
  effectivePriceFit: number;
  /** Best- and worst-captured segments — drives the readable "won Pro, lost Budget on price" verdict. */
  dominant: SegmentId;
  weakest: SegmentId;
}

/** The full segmented demand for a product at a given price + market trend. Pure; drives both the
 *  build-wizard preview and the launch, and feeds the post-launch verdict (pillar #5). */
export function segmentDemand(
  stats: Stats,
  price: Money,
  trends: ConsumerTrends,
  category: CategoryId,
  /** G1 — bonus to the Style segment's fit from the device's form/design language (engine/aesthetics).
   *  Defaults to 0 so callers/tests that don't model form are unaffected. Applies to Style ONLY. */
  styleAppeal = 0,
  /** Track B — current week, to apply the market-climate segment cycle (engine/climate.ts). Omitted →
   *  no cycle (sizes are the static base), so every existing caller/test is byte-identical. */
  week?: number,
  /** D1: the build's tier bottleneck (0..1, from componentSynergy): how far the weakest component
   *  sits below the build's level. Discounts demand for coherence-valuing segments (Mainstream,
   *  Enterprise) while Pro shrugs it off. Defaults to 0 (a perfectly coherent build) so every existing
   *  caller/test that doesn't model tiers is byte-identical. */
  bottleneck = 0,
): SegmentDemand {
  // Market climate (Track B): segment sizes swell/fade on slow cycles, RE-NORMALIZED so the cycle
  // redistributes the mix without changing the total market — timing positioning, not free volume.
  const sizeOf = ((): Record<SegmentId, number> => {
    // Base mix is category-specific (Track D buyer mixes); phone/unlisted use the default sizes.
    const baseSizes = {} as Record<SegmentId, number>;
    let baseTotal = 0;
    for (const seg of SEGMENTS) { const b = categorySegmentSize(category, seg); baseSizes[seg.id] = b; baseTotal += b; }
    if (week === undefined) return baseSizes;
    // Market climate (Track B): apply the seasonal cycle, then re-normalize back to the category's
    // total so the cycle only redistributes the mix (timing), never inflates the category's volume.
    let total = 0;
    const cycled = {} as Record<SegmentId, number>;
    for (const seg of SEGMENTS) { const c = baseSizes[seg.id] * segmentSizeMul(seg.id, week); cycled[seg.id] = c; total += c; }
    const out = {} as Record<SegmentId, number>;
    for (const seg of SEGMENTS) out[seg.id] = total > 0 ? (cycled[seg.id] / total) * baseTotal : baseSizes[seg.id];
    return out;
  })();

  const cs = BALANCE.market.segments;
  const bn = clamp(bottleneck, 0, 1);
  const perSegment: SegmentResult[] = SEGMENTS.map((seg) => {
    const rawFit = segmentFit(stats, seg, category, trends);
    // A striking, coherent form lifts the design-led Style segment only (no global ripple).
    const fit = seg.id === "style" ? Math.min(100, rawFit + Math.max(0, styleAppeal)) : rawFit;
    const priceFit = segmentPriceFit(price, fit, seg);
    const size = sizeOf[seg.id];
    // D1: tier-coherence desirability: a lopsided build discounts THIS segment's realized demand by
    // how much it values coherence. Only the bottleneck ABOVE the deadzone counts, so an ordinary
    // build (a little tier spread) is untouched and only a real weak link is discounted. bottleneck
    // ≤ threshold → mult 1 → no effect (byte-identical to pre-D1). Floored so it stays a tie-breaker.
    const excess = Math.max(0, bn - cs.coherenceThreshold);
    const cohMult = 1 - Math.min(cs.coherenceMaxDiscount, cs.coherenceStrength * seg.coherencePref * excess);
    return {
      id: seg.id,
      name: seg.name,
      size,
      fit,
      priceFit,
      captured: size * (fit / 100) * priceFit * cohMult,
    };
  });

  let demandIndex = 0;
  let priceWeighted = 0;
  for (const r of perSegment) {
    demandIndex += r.size * r.fit;
    // Sum the coherence-adjusted capture (when bottleneck is 0 this equals the old size×fit×priceFit).
    priceWeighted += r.captured;
  }
  const effectivePriceFit = demandIndex > 0 ? priceWeighted / (demandIndex / 100) : 0;

  let dominant = perSegment[0];
  let weakest = perSegment[0];
  for (const r of perSegment) {
    if (r.captured > dominant.captured) dominant = r;
    if (r.captured < weakest.captured) weakest = r;
  }

  return {
    perSegment,
    demandIndex,
    priceWeighted,
    effectivePriceFit,
    dominant: dominant.id,
    weakest: weakest.id,
  };
}
