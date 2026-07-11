// Market simulation — the heart. Scores a launch against current consumer trends,
// hype, price fit, and competition. PURE.
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import { dollars, toDollars, type Money } from "./money.ts";
import { overallScore } from "./product.ts";
import { bestSegmentPerceived } from "./segments.ts";
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

function hypeMultiplier(reputation: number, marketerSkill: number): number {
  const h = BALANCE.market.hype;
  const raw =
    h.base + reputation * h.reputationWeight + marketerSkill * h.marketerWeight;
  return Math.min(h.max, Math.max(h.base, raw));
}

/** 0..1.35 — how fair the price feels vs. perceived value. Asymmetric: UNDERpricing keeps a floor
 *  (a cheap product still sells) but OVERpricing craters toward 0, so demand is genuinely
 *  price-elastic and gouging fails (no "max price always sells"). */
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
  const raw = fit + underBoost;
  // Asymmetric floor. Underpricing keeps minFit (cheap stays teachable); overpricing is allowed to
  // decay to ~0. The old symmetric [minFit, maxFit] clamp made demand INELASTIC above ~1.8× fair —
  // units stopped falling while revenue = units × price kept climbing, so max price always won.
  // Letting the overpriced tail crater makes revenue peak near the fair price and gouging lose.
  const floored = ratio <= 1 ? Math.max(p.minFit, raw) : raw;
  return Math.min(p.maxFit, Math.max(0, floored));
}

/** B5 — the price band where priceFit stays ≥ guidanceFitFloor, shown to the player INSTEAD of
 *  the exact peak. Deliberately asymmetric: overpricing decays overpriceHarshness× faster, so the
 *  headroom above fair is smaller than the room below — the band itself teaches that overpricing
 *  hurts more (pillar #5). lo ≤ fair ≤ hi, whole dollars. Where inside the band to price is the
 *  player's margin-vs-volume call (under fair adds a small volume boost; over fair pads margin). */
export function priceGuidance(stats: Stats, category: CategoryId): { lo: Money; fair: Money; hi: Money } {
  const p = BALANCE.market.price;
  const overall = overallScore(stats, category); // 0..100, all-round value
  // A standout stat lets a specialised design command more than its all-round average implies —
  // the market sells through segments, and the best-fit segment values that stat highly. Nudge the
  // fair price partway toward that segment's perceived value; never BELOW the all-round baseline,
  // so a balanced product is unaffected and the advice only ever adds headroom for specialists.
  const perceived = overall + p.segmentLift * Math.max(0, bestSegmentPerceived(stats, category) - overall);
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
  synergy: number; // 0.8..1.06 — component-combination balance (bottleneck penalty / flagship bonus)
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
  /** The chosen launch CAMPAIGN's hype, kept SEPARATE from `hypeBonus` (passive/company hype) so it
   *  is added ON TOP of the passive-hype clamp — a bigger campaign always lifts the launch, even for
   *  a mature company whose passive hype already sits at the ceiling (before this, every campaign tier
   *  read identically once passive hype saturated). Bounded on its own so it can't explode either.
   *  Defaults to 0 → identical to the pre-campaign-lane behaviour for callers that don't pass it. */
  campaignHype?: number;
  /** Component-combination synergy multiplier (see product.componentSynergy). Defaults to 1 so
   *  callers that don't model it (and the bounds tests) are unaffected. */
  synergy?: number;
  /** Epic A — optional segmented-demand overrides. When provided, the launch is scored against the
   *  buyer-segment model (engine/segments.ts): demandOverride replaces the single-trend demandScore
   *  and priceFitOverride replaces the global priceFit. Omitted by default → identical to the
   *  pre-segments behaviour, so the bounds tests and any direct caller are unaffected. */
  demandOverride?: number;
  priceFitOverride?: number;
}): LaunchBreakdown {
  const demand = args.demandOverride ?? demandScore(args.stats, args.trends, args.category);
  // Total hype must be bounded: the base multiplier is already clamped to h.max, but
  // hype bonuses (brand studio + per-marketer visionary + marketing upgrade + channel)
  // are summed with no individual cap, so stacking marketers could make hype — and thus
  // launchScore/volume — explode. Clamp the combined value to a sane ceiling that mirrors
  // the internal hypeMultiplier clamp (a small multiple of its max), keeping intended play
  // intact while preventing runaway scores.
  const hypeCeiling = BALANCE.market.hype.max * 2;
  const rawHype = hypeMultiplier(args.reputation, args.marketerSkill) + (args.hypeBonus ?? 0);
  const passiveHype = Math.min(hypeCeiling, Math.max(0, rawHype));
  // The launch campaign adds its hype ON TOP of the clamped passive hype (its own bound keeps it
  // sane), so each campaign tier stays distinct and keeps mattering into the late game instead of
  // vanishing into the passive-hype ceiling.
  const campaignHype = Math.max(0, Math.min(BALANCE.market.hype.campaignMax, args.campaignHype ?? 0));
  const hype = passiveHype + campaignHype;
  const pf = args.priceFitOverride ?? priceFit(args.price, args.stats, args.category);
  const competitionFactor = 1 / (1 + args.competitorStrength * BALANCE.market.competition.factorK);
  const synergy = args.synergy ?? 1;
  const launchScore = Math.max(0, demand * hype * pf * competitionFactor * synergy);
  return { demand, hype, priceFit: pf, competitionFactor, synergy, launchScore };
}
