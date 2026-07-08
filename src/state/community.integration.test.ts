// State-layer fan community: sentiment evolves through the tick once you've shipped, superfans lift
// pre-orders, and a do-nothing run keeps sentiment 0 (matching the pinned sim).
import { describe, it, expect } from "vitest";
import { newGame, advanceOneWeek, communitySnapshot, planProduction, type GameState } from "./gameState.ts";
import { dollars } from "../engine/money.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";

function phone(): Product {
  return {
    id: "p", name: "Aurora", category: "phone",
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 3 },
    finish: "aluminium", colorIndex: 0, price: dollars(600), designTier: 2,
    camera: { count: 2, layout: "vertical", module: "squircle", flash: true, position: "topLeft" }, notch: "island",
  };
}
function hitLaunch(week: number): LaunchedProduct {
  return {
    product: phone(), stats: { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 },
    unitCost: dollars(200), launchScore: 90, launchedWeek: week, totalUnits: 50_000, weeklyUnits: [1000, 1000],
    unitsSold: 20_000, weeksElapsed: 0, revenueToDate: dollars(1_000_000), verdict: "hit",
  };
}

describe("community sentiment through the tick", () => {
  it("recent hits warm the community; superfans appear", () => {
    const g = { ...newGame(3), fans: 20_000, launched: [hitLaunch(4), hitLaunch(6)] } as GameState;
    let s: GameState = g;
    for (let i = 0; i < 6; i++) s = advanceOneWeek(s);
    expect((s.fanSentiment ?? 0)).toBeGreaterThan(0);      // warmed by the hits
    expect((s.superfans ?? 0)).toBeGreaterThan(0);          // a loyal core formed
    const snap = communitySnapshot(s);
    expect(["warm", "devoted"]).toContain(snap.tier);
  });

  it("a never-launched run keeps the community perfectly neutral (determinism-safe)", () => {
    let s = { ...newGame(7777), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 40; w++) s = advanceOneWeek(s);
    expect(s.fanSentiment ?? 0).toBe(0);
    expect(s.superfans ?? 0).toBe(0);
  });
});

describe("superfans lift pre-orders", () => {
  it("a build with superfans pre-orders harder than one without", () => {
    // Low fan count so pre-orders stay under the demand cap (where the superfan lift is visible, not
    // masked by preOrderCap).
    const base = { ...newGame(3), fans: 1_500, era: 2 } as GameState;
    const without = planProduction({ ...base, superfans: 0 }, phone(), 100_000, "none");
    const withSf = planProduction({ ...base, superfans: 1_500 }, phone(), 100_000, "none");
    expect(withSf.preOrders).toBeGreaterThan(without.preOrders);
  });
});
