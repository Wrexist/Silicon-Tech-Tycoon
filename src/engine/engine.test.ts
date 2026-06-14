import { describe, it, expect } from "vitest";
import { dollars, toDollars, type Money } from "./money.ts";
import { BALANCE } from "./balance.ts";
import { COMPONENT_LINES, CATEGORIES, maxTier } from "./catalogs.ts";
import { computeStats, buildCost, overallScore, missingSlots } from "./product.ts";
import {
  initialTrends,
  advanceTrends,
  priceFit,
  priceGuidance,
  scoreLaunch,
  randomTrendTarget,
} from "./market.ts";
import { forecast } from "./salesCurve.ts";
import { runwayWeeks, isBankrupt, salaryFor, discountedRd } from "./economy.ts";
import { canAdvanceEra, isCategoryUnlocked, unlockedCategories } from "./eras.ts";
import { makeRng } from "./rng.ts";
import type { Product, Stats } from "./types.ts";

function phone(opts: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test",
    category: "phone",
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 2, camera: 2 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(600),
    designTier: 1,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    ...opts,
  };
}

describe("catalog integrity", () => {
  it("has unique ascending tier costs per line", () => {
    for (const line of Object.values(COMPONENT_LINES)) {
      for (let i = 1; i < line.tiers.length; i++) {
        expect(line.tiers[i].rdCost).toBeGreaterThanOrEqual(line.tiers[i - 1].rdCost);
        expect(line.tiers[i].tier).toBe(i + 1);
      }
    }
  });
  it("every category references valid component slots", () => {
    for (const cat of Object.values(CATEGORIES)) {
      for (const slot of cat.slots) {
        expect(COMPONENT_LINES[slot]).toBeDefined();
      }
    }
  });
  it("exactly one starter category", () => {
    const starters = Object.values(CATEGORIES).filter((c) => c.starter);
    expect(starters).toHaveLength(1);
    expect(starters[0].id).toBe("phone");
  });
});

describe("product stats & cost", () => {
  it("computes higher stats for higher tiers", () => {
    const low = computeStats(phone({ tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } }));
    const high = computeStats(phone({ tiers: { chip: 5, display: 5, battery: 5, materials: 4, software: 4, camera: 4 } }));
    expect(high.performance).toBeGreaterThan(low.performance);
    expect(high.quality).toBeGreaterThan(low.quality);
  });
  it("clamps stats to 0..100", () => {
    const s = computeStats(phone({ tiers: { chip: 6, display: 6, battery: 6, materials: 5, software: 5, camera: 4 }, designTier: 12 }));
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it("build cost is the sum of selected component unit costs", () => {
    const cost = buildCost(phone({ tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } }));
    // 18 + 14 + 6 + 8 + 0 + 9 = 55
    expect(cost).toBe(dollars(55));
  });
  it("reports missing slots", () => {
    expect(missingSlots(phone({ tiers: { chip: 1 } }))).toContain("display");
  });
  it("design tier raises the design stat", () => {
    const base = computeStats(phone({ designTier: 1 }));
    const designed = computeStats(phone({ designTier: 4 }));
    expect(designed.design).toBeGreaterThan(base.design);
  });
});

describe("market simulation", () => {
  const trends = initialTrends(makeRng(1));

  it("a great-fit product beats a mistimed/weak one", () => {
    const great = computeStats(phone({ tiers: { chip: 5, display: 5, battery: 5, materials: 4, software: 4, camera: 4 } }));
    const weak = computeStats(phone({ tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } }));
    const a = scoreLaunch({ stats: great, category: "phone", price: dollars(900), trends, reputation: 30, marketerSkill: 5, competitorStrength: 0 });
    const b = scoreLaunch({ stats: weak, category: "phone", price: dollars(900), trends, reputation: 30, marketerSkill: 5, competitorStrength: 0 });
    expect(a.launchScore).toBeGreaterThan(b.launchScore);
  });

  it("overpricing reduces price fit", () => {
    const stats = computeStats(phone());
    const fair = priceFit(dollars(600), stats, "phone");
    const gouge = priceFit(dollars(3000), stats, "phone");
    expect(gouge).toBeLessThan(fair);
  });

  it("overpricing collapses revenue — a fair price out-earns gouging (no max-price exploit)", () => {
    const stats = computeStats(phone({ tiers: { chip: 4, display: 4, battery: 3, materials: 3, software: 3, camera: 3 } }));
    const fairP = priceGuidance(stats, "phone").fair;
    const sim = (price: Money) => {
      const bd = scoreLaunch({ stats, category: "phone", price, trends, reputation: 40, marketerSkill: 5, competitorStrength: 10 });
      const units = forecast(bd.launchScore, 1, bd.priceFit).totalUnits;
      return { units, revenue: units * toDollars(price) };
    };
    const fair = sim(fairP);
    const dbl = sim(dollars(toDollars(fairP) * 2));
    const gouge = sim(dollars(toDollars(fairP) * 6));
    // pricing DOUBLE the fair value loses revenue; a 6× gouge collapses it (units crater faster
    // than price climbs) — so "set max price, sell anyway" is no longer a winning strategy.
    expect(dbl.revenue).toBeLessThan(fair.revenue);
    expect(gouge.revenue).toBeLessThan(fair.revenue * 0.2);
    // units crater at the gouge price — the teachable floor doesn't prop gouging up
    expect(gouge.units).toBeLessThan(fair.units * 0.1);
    // sanity: a fairly-priced product of this quality still sells well (not floored)
    expect(fair.units).toBeGreaterThan(BALANCE.sales.floorUnits * 5);
  });

  it("priceGuidance brackets the fair price with an asymmetric, fit-honest band (B5)", () => {
    const stats = computeStats(phone({ tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 3 } }));
    const g = priceGuidance(stats, "phone");
    expect(toDollars(g.lo)).toBeLessThan(toDollars(g.fair));
    expect(toDollars(g.fair)).toBeLessThan(toDollars(g.hi));
    // overpricing decays harder → less headroom above fair than room below it
    expect(toDollars(g.hi) - toDollars(g.fair)).toBeLessThan(toDollars(g.fair) - toDollars(g.lo));
    // the band is honest: fit at both edges stays at/above the advertised floor (rounding slack)
    const floor = BALANCE.market.price.guidanceFitFloor - 0.01;
    expect(priceFit(g.lo, stats, "phone")).toBeGreaterThanOrEqual(floor);
    expect(priceFit(g.hi, stats, "phone")).toBeGreaterThanOrEqual(floor);
    // and the peak isn't outside it: fair fits at least as well as either edge
    expect(priceFit(g.fair, stats, "phone")).toBeGreaterThanOrEqual(priceFit(g.hi, stats, "phone"));
    // a better product commands a higher band
    const better = computeStats(phone({ tiers: { chip: 5, display: 5, battery: 5, materials: 5, software: 5, camera: 5 } }));
    expect(toDollars(priceGuidance(better, "phone").lo)).toBeGreaterThan(toDollars(g.lo));
    // degenerate stats stay ordered and positive
    const zeros = { performance: 0, quality: 0, battery: 0, design: 0, ecosystem: 0 } as Stats;
    const z = priceGuidance(zeros, "phone");
    expect(toDollars(z.lo)).toBeGreaterThan(0);
    expect(toDollars(z.lo)).toBeLessThanOrEqual(toDollars(z.fair));
    expect(toDollars(z.fair)).toBeLessThanOrEqual(toDollars(z.hi));
  });

  it("trend shifts change which product wins", () => {
    // Build two products: one battery-heavy, one performance-heavy.
    const batteryKing = computeStats(phone({ tiers: { chip: 1, display: 2, battery: 5, materials: 2, software: 2, camera: 1 } }));
    const perfKing = computeStats(phone({ tiers: { chip: 5, display: 2, battery: 1, materials: 2, software: 2, camera: 1 } }));

    const batteryTrend = { weights: { performance: 0.05, quality: 0.1, battery: 0.7, design: 0.1, ecosystem: 0.05 } as Stats, targetWeights: {} as Stats };
    const perfTrend = { weights: { performance: 0.7, quality: 0.1, battery: 0.05, design: 0.1, ecosystem: 0.05 } as Stats, targetWeights: {} as Stats };

    const bUnderBattery = scoreLaunch({ stats: batteryKing, category: "phone", price: dollars(500), trends: batteryTrend, reputation: 20, marketerSkill: 3, competitorStrength: 0 });
    const pUnderBattery = scoreLaunch({ stats: perfKing, category: "phone", price: dollars(500), trends: batteryTrend, reputation: 20, marketerSkill: 3, competitorStrength: 0 });
    expect(bUnderBattery.launchScore).toBeGreaterThan(pUnderBattery.launchScore);

    const bUnderPerf = scoreLaunch({ stats: batteryKing, category: "phone", price: dollars(500), trends: perfTrend, reputation: 20, marketerSkill: 3, competitorStrength: 0 });
    const pUnderPerf = scoreLaunch({ stats: perfKing, category: "phone", price: dollars(500), trends: perfTrend, reputation: 20, marketerSkill: 3, competitorStrength: 0 });
    expect(pUnderPerf.launchScore).toBeGreaterThan(bUnderPerf.launchScore);
  });

  it("competition lowers the launch score", () => {
    const stats = computeStats(phone());
    const clear = scoreLaunch({ stats, category: "phone", price: dollars(600), trends, reputation: 30, marketerSkill: 5, competitorStrength: 0 });
    const crowded = scoreLaunch({ stats, category: "phone", price: dollars(600), trends, reputation: 30, marketerSkill: 5, competitorStrength: 80 });
    expect(crowded.launchScore).toBeLessThan(clear.launchScore);
  });

  it("trends drift toward their target", () => {
    const start = initialTrends(makeRng(7));
    const target = randomTrendTarget(makeRng(99));
    let t = start;
    for (let i = 0; i < 40; i++) t = advanceTrends(t, target);
    for (const k of Object.keys(target) as (keyof Stats)[]) {
      expect(Math.abs(t.weights[k] - target[k])).toBeLessThan(0.05);
    }
  });
});

describe("sales curve", () => {
  it("weekly units sum exactly to the forecast total", () => {
    const f = forecast(120, 1.0);
    const sum = f.weeklyUnits.reduce((a, b) => a + b, 0);
    expect(sum).toBe(f.totalUnits);
  });
  it("higher launch score yields more volume", () => {
    expect(forecast(200, 1).totalUnits).toBeGreaterThan(forecast(50, 1).totalUnits);
  });
  it("peaks then declines", () => {
    const f = forecast(150, 1);
    const peak = Math.max(...f.weeklyUnits);
    expect(f.weeklyUnits[0]).toBeLessThan(peak);
    expect(f.weeklyUnits[f.weeklyUnits.length - 1]).toBeLessThan(peak);
  });
});

describe("economy", () => {
  it("computes runway and bankruptcy", () => {
    expect(runwayWeeks(dollars(10_000), dollars(1_000))).toBe(10);
    expect(runwayWeeks(dollars(10_000), dollars(1_000), dollars(1_000))).toBe(Infinity);
    expect(isBankrupt(dollars(-1))).toBe(true);
    expect(isBankrupt(dollars(0))).toBe(false);
  });
  it("salary scales with skill; R&D discount with engineer skill", () => {
    expect(salaryFor("engineer", 5)).toBeGreaterThan(salaryFor("engineer", 1));
    expect(discountedRd(dollars(10_000), 10)).toBeLessThan(dollars(10_000));
    expect(discountedRd(dollars(10_000), 0)).toBe(dollars(10_000));
  });
});

describe("eras", () => {
  it("gates categories by era", () => {
    expect(isCategoryUnlocked("phone", 1)).toBe(true);
    expect(isCategoryUnlocked("laptop", 1)).toBe(false);
    expect(isCategoryUnlocked("laptop", 2)).toBe(true);
    expect(unlockedCategories(1)).toEqual(["phone", "tablet"]);
  });
  it("advances on reputation OR revenue threshold", () => {
    expect(canAdvanceEra(1, 40, dollars(0))).toBe(true); // rep path
    expect(canAdvanceEra(1, 5, dollars(600_000))).toBe(true); // revenue path
    expect(canAdvanceEra(1, 5, dollars(1_000))).toBe(false);
  });
});

describe("misc", () => {
  it("overall score respects category emphasis", () => {
    const s = computeStats(phone({ tiers: { chip: 5, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } }));
    expect(overallScore(s, "phone")).toBeGreaterThan(0);
  });
  it("maxTier reports line length", () => {
    expect(maxTier("chip")).toBe(6);
  });
});
