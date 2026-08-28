// Dedicated characterization tests for engine/market.ts — trends, price fit, hype clamps and the
// launch-score assembly. Complements engine.test.ts (integration) and balanceGuards.test.ts (the
// no-universal-recipe / elastic-demand guards) without duplicating them.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import {
  initialTrends,
  randomTrendTarget,
  advanceTrends,
  effectiveWeights,
  demandScore,
  priceFit,
  priceGuidance,
  demandVarianceMultiplier,
  scoreLaunch,
} from "./market.ts";
import { makeRng } from "./rng.ts";
import { STAT_KEYS, type ConsumerTrends, type Stats } from "./types.ts";

const uniform = (v: number): Stats =>
  ({ performance: v, quality: v, battery: v, design: v, ecosystem: v });

function sumWeights(w: Stats): number {
  return STAT_KEYS.reduce((a, k) => a + w[k], 0);
}

describe("trends", () => {
  it("initialTrends starts with normalized weights equal to their target", () => {
    const t = initialTrends(makeRng(42));
    expect(sumWeights(t.weights)).toBeCloseTo(1, 10);
    expect(t.weights).toEqual(t.targetWeights);
  });

  it("randomTrendTarget is a normalized, strictly positive distribution — and seed-deterministic", () => {
    const a = randomTrendTarget(makeRng(7));
    const b = randomTrendTarget(makeRng(7));
    expect(a).toEqual(b);
    expect(sumWeights(a)).toBeCloseTo(1, 10);
    for (const k of STAT_KEYS) expect(a[k]).toBeGreaterThan(0);
  });

  it("advanceTrends eases toward the target, keeps normalization, and keeps the old target when none is passed", () => {
    const start = initialTrends(makeRng(3));
    const target = randomTrendTarget(makeRng(99));
    const stepped = advanceTrends(start, target);
    expect(stepped.targetWeights).toEqual(target);
    expect(sumWeights(stepped.weights)).toBeCloseTo(1, 10);
    // strictly closer to the target than before (on at least the largest-gap key)
    const gapBefore = STAT_KEYS.reduce((a, k) => a + Math.abs(start.weights[k] - target[k]), 0);
    const gapAfter = STAT_KEYS.reduce((a, k) => a + Math.abs(stepped.weights[k] - target[k]), 0);
    expect(gapAfter).toBeLessThan(gapBefore);
    // no new target → the stored one carries forward
    const again = advanceTrends(stepped);
    expect(again.targetWeights).toEqual(target);
  });

  it("effectiveWeights blends category emphasis and renormalizes", () => {
    const t = initialTrends(makeRng(11));
    const phoneW = effectiveWeights(t, "phone");
    const deskW = effectiveWeights(t, "desktop");
    expect(sumWeights(phoneW)).toBeCloseTo(1, 10);
    expect(sumWeights(deskW)).toBeCloseTo(1, 10);
    // desktop's 1.4 performance emphasis tilts its normalized performance share above the phone's 1.0
    expect(deskW.performance).toBeGreaterThan(phoneW.performance);
  });
});

describe("demandScore", () => {
  it("is a weighted average: a uniform stat profile scores exactly that value", () => {
    const t = initialTrends(makeRng(5));
    expect(demandScore(uniform(60), t, "phone")).toBeCloseTo(60, 8);
    expect(demandScore(uniform(0), t, "phone")).toBeCloseTo(0, 8);
    expect(demandScore(uniform(100), t, "wearable")).toBeCloseTo(100, 8);
  });

  it("rewards matching the trend's hot stat", () => {
    const hotPerf: ConsumerTrends = {
      weights: { performance: 0.7, quality: 0.1, battery: 0.05, design: 0.1, ecosystem: 0.05 } as Stats,
      targetWeights: {} as Stats,
    };
    const perfKing = { ...uniform(40), performance: 90 };
    const battKing = { ...uniform(40), battery: 90 };
    expect(demandScore(perfKing, hotPerf, "phone")).toBeGreaterThan(demandScore(battKing, hotPerf, "phone"));
  });
});

describe("priceFit", () => {
  const stats = uniform(60); // balanced → priceGuidance.fair has no segment lift, so it IS the peak
  const fair = priceGuidance(stats, "phone").fair;

  it("peaks at exactly 1 at the fair price for a balanced product", () => {
    expect(priceFit(fair, stats, "phone")).toBeCloseTo(1, 5);
  });

  it("is asymmetric: overpricing craters below the underpricing floor", () => {
    const p = BALANCE.market.price;
    const under = priceFit(dollars(toDollars(fair) * 0.1), stats, "phone");
    const over = priceFit(dollars(toDollars(fair) * 3), stats, "phone");
    expect(under).toBeGreaterThanOrEqual(p.minFit); // cheap keeps the teachable floor
    expect(over).toBeLessThan(p.minFit); // gouging is allowed to decay toward 0
    expect(over).toBeGreaterThanOrEqual(0);
    // and the same absolute deviation hurts more above fair than below
    expect(priceFit(dollars(toDollars(fair) * 1.5), stats, "phone")).toBeLessThan(
      priceFit(dollars(toDollars(fair) * 0.5), stats, "phone"),
    );
  });

  it("stays inside [0, maxFit] across a wide price sweep", () => {
    for (let mult = 0.05; mult <= 6; mult += 0.25) {
      const fit = priceFit(dollars(Math.max(1, Math.round(toDollars(fair) * mult))), stats, "phone");
      expect(fit).toBeGreaterThanOrEqual(0);
      expect(fit).toBeLessThanOrEqual(BALANCE.market.price.maxFit);
    }
  });

  it("handles a zero-stat product: the fair price floors at $1 and fit stays finite", () => {
    const fit = priceFit(dollars(1), uniform(0), "phone");
    expect(Number.isFinite(fit)).toBe(true);
    expect(fit).toBeGreaterThan(0);
  });
});

describe("demandVarianceMultiplier", () => {
  it("is bounded to [1−v, 1+v] and seed-deterministic", () => {
    const v = BALANCE.market.demandVariance;
    for (const seed of [1, 2, 3, 55, 999]) {
      const m = demandVarianceMultiplier(makeRng(seed));
      expect(m).toBeGreaterThanOrEqual(1 - v);
      expect(m).toBeLessThanOrEqual(1 + v);
      expect(demandVarianceMultiplier(makeRng(seed))).toBe(m);
    }
  });
});

describe("scoreLaunch", () => {
  const trends = initialTrends(makeRng(9));
  const base = {
    stats: uniform(60),
    category: "phone" as const,
    price: dollars(450),
    trends,
    reputation: 40,
    marketerSkill: 10,
    competitorStrength: 0,
  };

  it("assembles launchScore as demand × hype × priceFit × competitionFactor × synergy", () => {
    const b = scoreLaunch(base);
    expect(b.launchScore).toBeCloseTo(b.demand * b.hype * b.priceFit * b.competitionFactor * b.synergy, 8);
    expect(b.synergy).toBe(1); // defaults to 1 when not passed
    expect(b.competitionFactor).toBe(1); // zero competitor strength
  });

  it("competitionFactor follows 1 / (1 + strength × factorK)", () => {
    const k = BALANCE.market.competition.factorK;
    for (const strength of [10, 40, 120]) {
      const b = scoreLaunch({ ...base, competitorStrength: strength });
      expect(b.competitionFactor).toBeCloseTo(1 / (1 + strength * k), 10);
    }
  });

  it("passive hype (base + hypeBonus) is clamped to twice hype.max", () => {
    const ceiling = BALANCE.market.hype.max * 2;
    const b = scoreLaunch({ ...base, hypeBonus: 1000 });
    expect(b.hype).toBe(ceiling);
  });

  it("campaign hype adds ON TOP of the passive clamp, bounded by campaignMax; negatives clamp to 0", () => {
    const ceiling = BALANCE.market.hype.max * 2;
    const maxed = scoreLaunch({ ...base, hypeBonus: 1000, campaignHype: 1000 });
    expect(maxed.hype).toBe(ceiling + BALANCE.market.hype.campaignMax);
    const modest = scoreLaunch({ ...base, campaignHype: 0.5 });
    const none = scoreLaunch({ ...base });
    expect(modest.hype).toBeCloseTo(none.hype + 0.5, 10);
    expect(scoreLaunch({ ...base, campaignHype: -5 }).hype).toBe(none.hype);
  });

  it("hype rises with reputation and marketer skill up to hype.max", () => {
    const low = scoreLaunch({ ...base, reputation: 0, marketerSkill: 0 });
    const mid = scoreLaunch({ ...base, reputation: 60, marketerSkill: 10 });
    expect(low.hype).toBe(BALANCE.market.hype.base); // the floor
    expect(mid.hype).toBeGreaterThan(low.hype);
    const saturated = scoreLaunch({ ...base, reputation: 100, marketerSkill: 1000 });
    expect(saturated.hype).toBe(BALANCE.market.hype.max);
  });

  it("demand/priceFit overrides replace the internal models verbatim", () => {
    const b = scoreLaunch({ ...base, demandOverride: 42, priceFitOverride: 0.9 });
    expect(b.demand).toBe(42);
    expect(b.priceFit).toBe(0.9);
    expect(b.launchScore).toBeCloseTo(42 * b.hype * 0.9 * 1 * 1, 8);
  });

  it("launchScore never goes negative, even with a negative demand override", () => {
    const b = scoreLaunch({ ...base, demandOverride: -50 });
    expect(b.launchScore).toBe(0);
  });
});
