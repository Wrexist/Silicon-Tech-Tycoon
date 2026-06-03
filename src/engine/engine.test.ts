import { describe, it, expect } from "vitest";
import { dollars } from "./money.ts";
import { COMPONENT_LINES, CATEGORIES, maxTier } from "./catalogs.ts";
import { computeStats, buildCost, overallScore, missingSlots } from "./product.ts";
import {
  initialTrends,
  advanceTrends,
  priceFit,
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
