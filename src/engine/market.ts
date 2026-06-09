// Market simulation — the heart. Scores a launch against current consumer trends,
// hype, price fit, and competition. PURE.
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import { dollars, toDollars, type Money } from "./money.ts";
import { overallScore } from "./product.ts";
import type { Rng } from "./rng.ts";
import {
  STAT_KEYS,
  type CategoryId,
  type ConsumerTrends,
  type Stats,
} from "./types.ts";

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

export function initialTrends(rng: Rng): ConsumerTrends {
  const target = randomTrendTarget(rng);
  return { weights: target, targetWeights: target };
}

export function randomTrendTarget(rng: Rng): Stats {
  const raw = {} as Stats;
  for (const k of STAT_KEYS) raw[k] = 0.4 + rng.next() * 1.6;
  return normalize(raw);
}

/** Ease current weights toward target; occasionally retarget (caller passes new target). */
export function advanceTrends(t: ConsumerTrends, newTarget?: Stats): ConsumerTrends {
  const target = newTarget ?? t.targetWeights;
  const e = BALANCE.market.trendDrift.easing;
  const w = {} as Stats;
  for (const k of STAT_KEYS) w[k] = t.weights[k] + (target[k] - t.weights[k]) * e;
  return { weights: normalize(w), targetWeights: target };
}

/** Blend trend weights with the category's taste emphasis, renormalized. */
export function effectiveWeights(trends: ConsumerTrends, category: CategoryId): Stats {
  const emphasis = CATEGORIES[category].statEmphasis;
  const blended = {} as Stats;
  for (const k of STAT_KEYS) blended[k] = trends.weights[k] * (emphasis[k] ?? 0.7);
  return normalize(blended);
}

/** 0..100 — how well the product matches what consumers want right now. */
export function demandScore(stats: Stats, trends: ConsumerTrends, category: CategoryId): number {
  const w = effectiveWeights(trends, category);
  let acc = 0;
  for (const k of STAT_KEYS) acc += w[k] * stats[k];
  return acc;
}

export function hypeMultiplier(reputation: number, marketerSkill: number): number {
  const h = BALANCE.market.hype;
  const raw =
    h.base + reputation * h.reputationWeight + marketerSkill * h.marketerWeight;
  return Math.min(h.max, Math.max(h.base, raw));
}

/** 0.15..1.35 — how fair the price feels vs. perceived value (asymmetric: overpricing hurts more). */
export function priceFit(price: Money, stats: Stats, category: CategoryId): number {
  const p = BALANCE.market.price;
  const perceived = overallScore(stats, category); // 0..100
  const fairDollars = Math.max(1, perceived * toDollars(p.valueToPrice));
  const ratio = toDollars(price) / fairDollars;
  let dev = ratio - 1;
  if (dev > 0) dev *= p.overpriceHarshness; // overpricing penalised harder
  const fit = Math.exp(-(dev * dev) / (2 * p.tolerance * p.tolerance));
  // Slight volume reward for modest underpricing.
  const underBoost = ratio < 1 ? (1 - ratio) * 0.25 : 0;
  return Math.min(p.maxFit, Math.max(p.minFit, fit + underBoost));
}

/** B5 — the price band where priceFit stays ≥ guidanceFitFloor, shown to the player INSTEAD of
 *  the exact peak. Deliberately asymmetric: overpricing decays overpriceHarshness× faster, so the
 *  headroom above fair is smaller than the room below — the band itself teaches that overpricing
 *  hurts more (pillar #5). lo ≤ fair ≤ hi, whole dollars. Where inside the band to price is the
 *  player's margin-vs-volume call (under fair adds a small volume boost; over fair pads margin). */
export function priceGuidance(stats: Stats, category: CategoryId): { lo: Money; fair: Money; hi: Money } {
  const p = BALANCE.market.price;
  const perceived = overallScore(stats, category); // 0..100
  const fairDollars = Math.max(1, perceived * toDollars(p.valueToPrice));
  // fit = exp(−dev²/(2·tol²)) ≥ floor  ⇔  |dev| ≤ tol·√(2·ln(1/floor))
  const halfWidth = p.tolerance * Math.sqrt(2 * Math.log(1 / p.guidanceFitFloor));
  const lo = Math.max(1, Math.round(fairDollars * (1 - halfWidth)));
  const hi = Math.max(lo, Math.round(fairDollars * (1 + halfWidth / p.overpriceHarshness)));
  return { lo: dollars(lo), fair: dollars(Math.round(fairDollars)), hi: dollars(hi) };
}

/**
 * B9 — seeded demand variance multiplier for an ACTUAL launch. The forecast shown in the wizard is
 * a deterministic point estimate; this jitters the realized volume by up to ±demandVariance so that
 * over/under-producing is a genuine bet (pillar #3). It is SEED-DETERMINISTIC (driven by the passed
 * Rng — never Math.random) and BOUNDED to [1-v, 1+v]. Returns exactly 1 when demandVariance is 0.
 *
 * Used only at launch (launchReady), never in the planning preview, so the wizard keeps showing the
 * honest forecast/band while the real outcome can land anywhere inside it.
 */
export function demandVarianceMultiplier(rng: Rng): number {
  const v = BALANCE.market.demandVariance;
  if (v <= 0) return 1;
  // rng.range(-v, v) is already bounded to (−v, v); clamp defensively so the result is provably in
  // [1−v, 1+v] regardless of future RNG changes, and never produces a negative volume multiplier.
  const delta = Math.max(-v, Math.min(v, rng.range(-v, v)));
  return 1 + delta;
}

export interface LaunchBreakdown {
  demand: number;
  hype: number;
  priceFit: number;
  competitionFactor: number; // 0..1 share multiplier
  launchScore: number;
}

/** The full launch scoring. Returns the score and its readable breakdown (pillar #5). */
export function scoreLaunch(args: {
  stats: Stats;
  category: CategoryId;
  price: Money;
  trends: ConsumerTrends;
  reputation: number;
  marketerSkill: number;
  competitorStrength: number;
  hypeBonus?: number;
}): LaunchBreakdown {
  const demand = demandScore(args.stats, args.trends, args.category);
  // Total hype must be bounded: the base multiplier is already clamped to h.max, but
  // hype bonuses (brand studio + per-marketer visionary + marketing upgrade + channel)
  // are summed with no individual cap, so stacking marketers could make hype — and thus
  // launchScore/volume — explode. Clamp the combined value to a sane ceiling that mirrors
  // the internal hypeMultiplier clamp (a small multiple of its max), keeping intended play
  // intact while preventing runaway scores.
  const hypeCeiling = BALANCE.market.hype.max * 2;
  const rawHype = hypeMultiplier(args.reputation, args.marketerSkill) + (args.hypeBonus ?? 0);
  const hype = Math.min(hypeCeiling, Math.max(0, rawHype));
  const pf = priceFit(args.price, args.stats, args.category);
  const competitionFactor = 1 / (1 + args.competitorStrength * BALANCE.market.competition.factorK);
  const launchScore = Math.max(0, demand * hype * pf * competitionFactor);
  return { demand, hype, priceFit: pf, competitionFactor, launchScore };
}
