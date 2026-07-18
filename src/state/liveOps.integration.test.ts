// Sell-Window Ops (feature #2) — the Harvest reducer + determinism guards. Harvest is a player-initiated
// pure reducer (no RNG); the engine changes are gated on the optional `harvested` flag, so a product that
// never harvests (and the pinned do-nothing sim) is byte-identical. These tests pin all of that.
import { describe, it, expect } from "vitest";
import {
  newGame, advanceOneWeek, harvestProduct, marketingPush, cutProductPrice,
  type GameState,
} from "./gameState.ts";
import { harvestSettlement } from "../engine/liveOps.ts";
import { dollars, toDollars, ZERO } from "../engine/money.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";

function phone(id = "x"): Product {
  return {
    id, name: "Aurora One", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(200), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
}

function launched(over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: phone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(80), launchScore: 60, launchedWeek: 0,
    totalUnits: 2300, weeklyUnits: [200, 400, 600, 400, 300, 200, 120, 80], unitsSold: 0, weeksElapsed: 0,
    revenueToDate: ZERO, plannedUnits: 4000, ...over,
  };
}

// Normalize feed ids away (they embed a module-level counter that keeps counting across in-process runs),
// the same trick the 160-week reproducibility pin uses, so we can compare EVERYTHING else bit-for-bit.
const norm = (s: GameState) => ({ ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) });

describe("Harvest — the settlement reducer", () => {
  it("pays the settlement cash + fans and stamps the product harvested (once)", () => {
    const s: GameState = { ...newGame(1), cash: dollars(1_000_000), fans: 500, launched: [launched({ weeksElapsed: 4 })] };
    const quote = harvestSettlement(s.launched[0])!;
    const res = harvestProduct(s, "x");
    expect(res.ok).toBe(true);
    expect(toDollars(res.state.cash)).toBe(toDollars(s.cash) + toDollars(quote.cash));
    expect(res.state.fans).toBe(500 + quote.fans);
    expect(res.state.launched[0].harvested).toBe(true);
    // Irreversible / once-per-product: a second harvest is rejected.
    const again = harvestProduct(res.state, "x");
    expect(again.ok).toBe(false);
  });

  it("rejects harvesting a product whose window has already closed", () => {
    const s: GameState = { ...newGame(2), cash: dollars(1_000_000), launched: [launched({ weeksElapsed: 8 })] };
    expect(harvestProduct(s, "x").ok).toBe(false);
  });

  it("stops the tick from booking any further sales once harvested", () => {
    const s: GameState = { ...newGame(3), cash: dollars(1_000_000), launched: [launched({ weeksElapsed: 2 })] };
    const harvested = harvestProduct(s, "x").state;
    const soldBefore = harvested.launched[0].unitsSold;
    const after = advanceOneWeek(harvested);
    // No more units sell, and weeksElapsed does NOT advance for the wound-down product.
    expect(after.launched[0].unitsSold).toBe(soldBefore);
    expect(after.launched[0].weeksElapsed).toBe(2);
  });
});

describe("Harvest — EV neutrality (a pacing choice, not free money)", () => {
  it("settles for no more than the tail the product would actually have booked", () => {
    const s: GameState = { ...newGame(4), cash: dollars(1_000_000), launched: [launched({ weeksElapsed: 3 })] };
    const quote = harvestSettlement(s.launched[0])!;
    // Let a clone run the tail out fully; cumulativeRevenue only accrues product gross (ecosystem goes to
    // cash), so its delta IS the realized tail gross the harvest is standing in for.
    let tail = s;
    const startRev = toDollars(tail.cumulativeRevenue);
    for (let w = 0; w < 8; w++) tail = advanceOneWeek(tail);
    const realizedTail = toDollars(tail.cumulativeRevenue) - startRev;
    expect(toDollars(quote.cash)).toBeLessThanOrEqual(realizedTail);           // never exceeds letting it run
    expect(toDollars(quote.cash)).toBeGreaterThanOrEqual(0.8 * realizedTail);  // but stays a *slight* discount
  });
});

describe("Sell-Window Ops — determinism guards", () => {
  it("a launched product that never harvests is byte-identical across two runs (old-save-safe)", () => {
    const start: GameState = { ...newGame(5), cash: dollars(10_000_000), launched: [launched()] };
    const clone = structuredClone(start);
    const run = (s0: GameState) => { let s = s0; for (let w = 0; w < 20; w++) s = advanceOneWeek(s); return s; };
    const a = run(start);
    const b = run(clone);
    expect(norm(b)).toEqual(norm(a));
    // …and it sold down its curve normally, with no ops field ever minted.
    expect(a.launched[0].harvested).toBeUndefined();
    expect(a.launched[0].unitsSold).toBeGreaterThan(0);
  });

  it("a scripted boost → price-cut → harvest run replays byte-identically twice", () => {
    const start: GameState = { ...newGame(6), cash: dollars(10_000_000), launched: [launched()] };
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      s = advanceOneWeek(s);                              // wk 1 — rising
      s = marketingPush(s, "x").state;                   // Boost before the peak
      s = advanceOneWeek(s);
      s = advanceOneWeek(s);
      s = cutProductPrice(s, "x", dollars(150)).state;   // Price cut mid-tail
      s = advanceOneWeek(s);
      s = harvestProduct(s, "x").state;                  // Harvest the rest
      s = advanceOneWeek(s);
      s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(b)).toEqual(norm(a));
    // The script actually exercised the levers.
    expect(a.launched[0].harvested).toBe(true);
    expect(a.launched[0].marketingPushes).toBe(1);
    expect(a.launched[0].priceCuts).toBe(1);
  });

  it("the do-nothing week is untouched by the feature (no harvested field appears)", () => {
    const base: GameState = { ...newGame(7), cash: dollars(10_000_000), launched: [launched()] };
    const a = advanceOneWeek(base);
    const b = advanceOneWeek(base);
    expect(a.launched[0].unitsSold).toBe(200); // weeklyUnits[0] of the fixture
    expect(a.launched[0].unitsSold).toBe(b.launched[0].unitsSold);
    expect(a.launched[0].harvested).toBeUndefined();
    expect(a.cash).toBe(b.cash);
  });
});
