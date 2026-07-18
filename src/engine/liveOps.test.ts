// Sell-Window Ops (feature #2) — unit tests for the pure derivations: the momentum meter and the
// harvest settlement math. No RNG, no state — just curve reads.
import { describe, it, expect } from "vitest";
import { productMomentum, harvestSettlement } from "./liveOps.ts";
import { BALANCE } from "./balance.ts";
import { dollars, toDollars, ZERO } from "./money.ts";
import type { LaunchedProduct, Product } from "./types.ts";

function phone(id = "x"): Product {
  return {
    id, name: "Aurora One", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(200), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
}

// A curve that ramps to a peak at week 2 (index 2) then declines — so momentum should rise, crest, fall.
function launched(over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: phone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(80), launchScore: 60, launchedWeek: 0,
    totalUnits: 2300, weeklyUnits: [200, 400, 600, 400, 300, 200, 120, 80], unitsSold: 0, weeksElapsed: 0,
    revenueToDate: ZERO, plannedUnits: 4000, ...over,
  };
}

describe("productMomentum — visualizes the sales curve (pure)", () => {
  it("rises toward the peak and decays after it", () => {
    const atStart = productMomentum(launched({ weeksElapsed: 0 }));   // 200/600
    const atPeak = productMomentum(launched({ weeksElapsed: 2 }));    // 600/600
    const pastPeak = productMomentum(launched({ weeksElapsed: 5 }));  // 200/600
    expect(atStart.phase).toBe("rising");
    expect(atPeak.phase).toBe("peak");
    expect(pastPeak.phase).toBe("declining");
    // The meter tracks the curve: peak is the fullest, and the tail is below the peak.
    expect(atPeak.pct).toBe(100);
    expect(atStart.pct).toBeLessThan(atPeak.pct);
    expect(pastPeak.pct).toBeLessThan(atPeak.pct);
    expect(atStart.pct).toBeGreaterThanOrEqual(0);
    expect(atPeak.value).toBeCloseTo(1, 5);
  });

  it("reads 0 / ended once the window closes or the product is harvested", () => {
    const done = productMomentum(launched({ weeksElapsed: 8 }));      // past the last curve week
    const cut = productMomentum(launched({ weeksElapsed: 3, harvested: true }));
    expect(done.phase).toBe("ended");
    expect(done.live).toBe(false);
    expect(done.pct).toBe(0);
    expect(cut.phase).toBe("ended");
    expect(cut.live).toBe(false);
    expect(cut.pct).toBe(0);
  });

  it("weeksLeft counts down and the peak marker is the curve's max week", () => {
    const m = productMomentum(launched({ weeksElapsed: 3 }));
    expect(m.weeksLeft).toBe(8 - 3);
    expect(m.peakWeek).toBe(2); // index of the 600-unit week
  });

  it("flags 'boost now' only once past the peak with no Boost spent (derived, not stored)", () => {
    expect(productMomentum(launched({ weeksElapsed: 1 })).crossedPeakBoostUnused).toBe(false); // still rising
    expect(productMomentum(launched({ weeksElapsed: 4 })).crossedPeakBoostUnused).toBe(true);  // past peak, unused
    expect(productMomentum(launched({ weeksElapsed: 4, marketingPushes: 1 })).crossedPeakBoostUnused).toBe(false); // boost spent
    expect(productMomentum(launched({ weeksElapsed: 4, harvested: true })).crossedPeakBoostUnused).toBe(false); // window closed
  });
});

describe("harvestSettlement — cash out the forgone tail at a convenience discount (pure)", () => {
  it("settles the remaining sellable units at the balance fraction of their gross", () => {
    const lp = launched({ weeksElapsed: 4 }); // remaining curve = 300+200+120+80 = 700
    const s = harvestSettlement(lp)!;
    expect(s).not.toBeNull();
    expect(s.units).toBe(700);
    // gross tail = 700 × $200; cash = 87% of that.
    expect(toDollars(s.grossTail)).toBe(700 * 200);
    expect(toDollars(s.cash)).toBe(Math.round(700 * BALANCE.liveOps.harvestSettlementFrac) * 200);
    // fans scale with the units settled.
    expect(s.fans).toBe(Math.round((700 / 1000) * BALANCE.liveOps.harvestFansPer1k));
  });

  it("is EV-neutral-ish: the settlement is a discount on (never more than) the expected tail", () => {
    for (const wk of [0, 2, 4, 6]) {
      const s = harvestSettlement(launched({ weeksElapsed: wk }))!;
      expect(toDollars(s.cash)).toBeLessThanOrEqual(toDollars(s.grossTail));           // never free money
      expect(toDollars(s.cash)).toBeGreaterThanOrEqual(0.8 * toDollars(s.grossTail));  // a *slight* discount, ~85-90%
    }
  });

  it("caps the settled units by the production run left, not just the curve", () => {
    // Only 100 units of supply remain even though the curve wants 700 → the harvest can't pay for
    // phantom units the factory never built.
    const lp = launched({ weeksElapsed: 4, totalUnits: 2300, unitsSold: 2200 });
    const s = harvestSettlement(lp)!;
    expect(s.units).toBe(100);
  });

  it("returns null when there's nothing left to harvest (ended or already harvested)", () => {
    expect(harvestSettlement(launched({ weeksElapsed: 8 }))).toBeNull();      // window closed
    expect(harvestSettlement(launched({ harvested: true }))).toBeNull();      // already wound down
    expect(harvestSettlement(launched({ weeksElapsed: 2, unitsSold: 2300, totalUnits: 2300 }))).toBeNull(); // sold out
  });
});
