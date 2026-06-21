// Sidegrade guard — pins that per-product TUNING is a real, trend-dependent build choice
// (EXECUTION_PLAN Phase 2b). The perf↔battery tuning already ships (gameState.productStats applies
// BALANCE.design.tuningShift); this test guards the DESIGN CLAIM that the trade genuinely flips the
// optimum with the market — i.e. it's a sidegrade, not a no-op. If a future balance change zeroes
// or shrinks tuningShift below the point where it matters, these fail.
//
// Pure-engine: it reconstructs the documented tuning transform (±tuningShift on performance/battery)
// over the same scoreLaunch the sim uses, so a magnitude regression in balance.ts is caught here.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import { type Stats, STAT_KEYS } from "./types.ts";
import type { CategoryId, ConsumerTrends } from "./types.ts";
import { scoreLaunch, priceGuidance } from "./market.ts";
import { forecast } from "./salesCurve.ts";

const CATEGORY: CategoryId = "phone";

/** Mirror of gameState.productStats' tuning branch — the shipped transform, clamped 0..statMax. */
function tuned(base: Stats, tuning: "balanced" | "performance" | "efficiency"): Stats {
  const shift = BALANCE.design.tuningShift;
  const s = { ...base };
  if (tuning === "performance") {
    s.performance += shift;
    s.battery -= shift;
  } else if (tuning === "efficiency") {
    s.battery += shift;
    s.performance -= shift;
  }
  for (const k of STAT_KEYS) s[k] = Math.max(0, Math.min(BALANCE.statMax, Math.round(s[k])));
  return s;
}

/** A demand climate that strongly favours one stat. */
function climateFavouring(stat: keyof Stats): ConsumerTrends {
  const weights = {} as Stats;
  for (const k of STAT_KEYS) weights[k] = 0.6;
  weights[stat] = 2.2;
  return { weights, targetWeights: weights };
}

function revenueAtFair(stats: Stats, trends: ConsumerTrends): number {
  const fairD = toDollars(priceGuidance(stats, CATEGORY).fair);
  const price = dollars(Math.round(fairD));
  const b = scoreLaunch({
    stats,
    category: CATEGORY,
    price,
    trends,
    reputation: 45,
    marketerSkill: 45,
    competitorStrength: 0,
  });
  return forecast(b.launchScore, 1.0, b.priceFit).totalUnits * fairD;
}

describe("tuning is a real sidegrade (not a no-op)", () => {
  it("the shift is non-zero (else tuning does nothing)", () => {
    expect(BALANCE.design.tuningShift).toBeGreaterThan(0);
  });

  const base: Stats = { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 };

  it("performance tuning wins when the market wants performance", () => {
    const trends = climateFavouring("performance");
    const perf = revenueAtFair(tuned(base, "performance"), trends);
    const eff = revenueAtFair(tuned(base, "efficiency"), trends);
    const bal = revenueAtFair(tuned(base, "balanced"), trends);
    expect(perf).toBeGreaterThan(eff);
    expect(perf).toBeGreaterThanOrEqual(bal);
  });

  it("efficiency tuning wins when the market wants battery life", () => {
    const trends = climateFavouring("battery");
    const perf = revenueAtFair(tuned(base, "performance"), trends);
    const eff = revenueAtFair(tuned(base, "efficiency"), trends);
    const bal = revenueAtFair(tuned(base, "balanced"), trends);
    expect(eff).toBeGreaterThan(perf);
    expect(eff).toBeGreaterThanOrEqual(bal);
  });

  it("the best tuning differs between the two climates (a trend-dependent choice)", () => {
    const perfClimate = climateFavouring("performance");
    const battClimate = climateFavouring("battery");
    const bestIn = (trends: ConsumerTrends) => {
      const opts = ["balanced", "performance", "efficiency"] as const;
      let best: (typeof opts)[number] = opts[0];
      let bestRev = -1;
      for (const t of opts) {
        const rev = revenueAtFair(tuned(base, t), trends);
        if (rev > bestRev) {
          bestRev = rev;
          best = t;
        }
      }
      return best;
    };
    expect(bestIn(perfClimate)).not.toBe(bestIn(battClimate));
  });
});
