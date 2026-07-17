// Live Product Ops (feature #2) — a standing auto-reorder policy with lead time. The engine's hottest
// path (post-launch sales) must stay byte-identical when NO policy is set, and a policy must never mint
// sales beyond the market's realized demand (no money printer). These tests pin both.
import { describe, it, expect } from "vitest";
import {
  newGame, advanceOneWeek, applyProductOps, setReorderRate, reorderLeadWeeks,
  type GameState,
} from "./gameState.ts";
import { dollars, toDollars, ZERO } from "../engine/money.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";

function goodPhone(id = "x"): Product {
  return {
    id, name: "Aurora One", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(140), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
}

function launched(over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: goodPhone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(50), launchScore: 60, launchedWeek: 0,
    totalUnits: 1000, weeklyUnits: [500, 300, 200], unitsSold: 0, weeksElapsed: 0, revenueToDate: ZERO,
    plannedUnits: 1000, ...over,
  };
}

describe("Live Product Ops — the no-op path is byte-identical", () => {
  it("applyProductOps leaves policy-free products (and cash) exactly as they were", () => {
    const s = { ...newGame(1), cash: dollars(10_000_000) };
    const lps = [launched({ product: goodPhone("a") }), launched({ product: goodPhone("b") })];
    const res = applyProductOps(s, lps, 5, s.cash);
    // Same object references (untouched), same cash, no feed.
    expect(res.launched[0]).toBe(lps[0]);
    expect(res.launched[1]).toBe(lps[1]);
    expect(res.cash).toBe(s.cash);
    expect(res.feed).toEqual([]);
  });

  it("a full tick with a policy-free launched product matches the pre-feature curve exactly", () => {
    const base: GameState = { ...newGame(2), cash: dollars(10_000_000), launched: [launched()] };
    const a = advanceOneWeek(base);
    const b = advanceOneWeek(base);
    // Sales booking is unchanged: the first curve week (500 units) sells exactly, no ops field added.
    // Pinning the concrete value (not just a === b self-comparison) catches a regression that shifts
    // the whole curve identically in both runs.
    expect(a.launched[0].unitsSold).toBe(500); // weeklyUnits[0] of the fixture curve
    expect(a.launched[0].unitsSold).toBe(b.launched[0].unitsSold); // …and still deterministic
    expect(a.launched[0].ops).toBeUndefined();
    expect(a.cash).toBe(b.cash);
  });
});

describe("Live Product Ops — orders, lead time, and delivery", () => {
  it("places a standing order that is charged now and arrives after the lead time", () => {
    const s = { ...newGame(3), cash: dollars(10_000_000) };
    const lp = launched({ ops: { reorderRate: 200, demandTotal: 2000, pending: [] } });
    const res = applyProductOps(s, [lp], 5, s.cash);
    const out = res.launched[0];
    expect(out.ops!.pending).toHaveLength(1);
    const order = out.ops!.pending![0];
    expect(order.units).toBe(200); // min(rate, headroom 1000, affordable)
    expect(order.arriveWeek).toBe(5 + reorderLeadWeeks(s)); // lead time applied
    expect(toDollars(res.cash)).toBeLessThan(toDollars(s.cash)); // paid up front
    // No delivery yet (nothing has arrived), so supply is unchanged this week.
    expect(out.totalUnits).toBe(lp.totalUnits);
  });

  it("delivers an arrived order onto the curve, raising supply", () => {
    const s = { ...newGame(4), cash: dollars(10_000_000) };
    const lp = launched({ ops: { reorderRate: 0, demandTotal: 2000, pending: [{ arriveWeek: 5, units: 300 }] } });
    const res = applyProductOps(s, [lp], 5, s.cash);
    const out = res.launched[0];
    expect(out.totalUnits).toBe(lp.totalUnits + 300); // supply grew by the delivered units
    expect(out.ops!.pending).toHaveLength(0); // the in-transit order landed
    expect(res.feed.length).toBe(1); // a "reorder landed" line
    // The extra units were overlaid onto the sales curve from the current week.
    expect(out.weeklyUnits.reduce((a, b) => a + b, 0)).toBeGreaterThan(lp.weeklyUnits.reduce((a, b) => a + b, 0));
  });
});

describe("Live Product Ops — bounded by demand (no money printer)", () => {
  it("never orders past the realized-demand ceiling", () => {
    const s = { ...newGame(5), cash: dollars(10_000_000) };
    // demandTotal already met by totalUnits → zero headroom → no order, cash untouched.
    const lp = launched({ totalUnits: 2000, ops: { reorderRate: 500, demandTotal: 2000, pending: [] } });
    const res = applyProductOps(s, [lp], 5, s.cash);
    expect(res.launched[0].ops!.pending).toHaveLength(0);
    expect(res.cash).toBe(s.cash);
  });

  it("total lifetime reorders across weeks can never exceed the demand snapshot", () => {
    const s = { ...newGame(6), cash: dollars(50_000_000) };
    let lp = launched({ totalUnits: 1000, ops: { reorderRate: 400, demandTotal: 1600, pending: [] } });
    let cash = s.cash;
    let orderedTotal = 0;
    // Run many weeks of ordering; each week's placed order counts toward the ceiling.
    for (let w = 1; w <= 30 && lp.weeksElapsed < lp.weeklyUnits.length + 50; w++) {
      const before = lp.ops!.pending?.reduce((a, p) => a + p.units, 0) ?? 0;
      const res = applyProductOps(s, [lp], w, cash);
      lp = res.launched[0];
      cash = res.cash;
      const after = lp.ops!.pending?.reduce((a, p) => a + p.units, 0) ?? 0;
      // account new orders (delivered ones leave pending but already raised totalUnits)
      orderedTotal = lp.totalUnits - 1000 + after; // delivered-into-supply + still-in-transit
      void before;
      // Keep the curve alive so ordering can continue.
      lp = { ...lp, weeklyUnits: [...lp.weeklyUnits, 1], weeksElapsed: Math.min(lp.weeksElapsed, 0) };
    }
    // Supply added + in-transit can never exceed the demand headroom (1600 − 1000 = 600).
    expect(orderedTotal).toBeLessThanOrEqual(600);
  });
});

describe("Live Product Ops — setReorderRate reducer", () => {
  it("sets a policy and snapshots the product's demand ceiling", () => {
    const s: GameState = { ...newGame(7), cash: dollars(10_000_000), launched: [launched()] };
    const res = setReorderRate(s, "x", 300);
    expect(res.ok).toBe(true);
    const ops = res.state.launched[0].ops!;
    expect(ops.reorderRate).toBe(300);
    expect(ops.demandTotal).toBeGreaterThanOrEqual(res.state.launched[0].totalUnits); // ceiling ≥ current supply
  });

  it("clearing the rate with nothing in transit removes the policy entirely (back to the plain curve)", () => {
    const withPolicy: GameState = { ...newGame(8), cash: dollars(10_000_000), launched: [launched({ ops: { reorderRate: 200, demandTotal: 2000, pending: [] } })] };
    const res = setReorderRate(withPolicy, "x", 0);
    expect(res.ok).toBe(true);
    expect(res.state.launched[0].ops).toBeUndefined();
  });

  it("re-tuning the rate keeps the original demand ceiling (never re-inflates it)", () => {
    const s: GameState = { ...newGame(9), cash: dollars(10_000_000), launched: [launched({ ops: { reorderRate: 100, demandTotal: 1234, pending: [] } })] };
    const res = setReorderRate(s, "x", 500);
    expect(res.state.launched[0].ops!.demandTotal).toBe(1234); // unchanged
    expect(res.state.launched[0].ops!.reorderRate).toBe(500);
  });
});
