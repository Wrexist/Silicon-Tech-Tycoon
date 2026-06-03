import { describe, it, expect } from "vitest";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  burn,
  buildWeeksFor,
  buildSafetyReserve,
  startBuild,
  launchReady,
  newGame,
  planProduction,
  recommendedRun,
  researchNext,
  researchedTier,
  hireStaff,
  rdRpCostFor,
} from "./gameState.ts";
import { toDollars } from "../engine/money.ts";

function goodPhone(): Product {
  return {
    id: "x",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

describe("game state reducers", () => {
  it("is deterministic from a seed", () => {
    const a = advanceOneWeek(advanceOneWeek(newGame(1234)));
    const b = advanceOneWeek(advanceOneWeek(newGame(1234)));
    expect(a.cash).toBe(b.cash);
    expect(a.week).toBe(b.week);
    expect(a.rngState).toBe(b.rngState);
  });

  it("builds then launches a product, accruing revenue over weeks", () => {
    // Production + tooling are paid upfront now, so seed enough cash to fund a real run + runway.
    let s = { ...newGame(42), cash: dollars(500_000) };
    const res = startBuild(s, goodPhone(), 800, "none");
    expect(res.ok).toBe(true);
    s = res.state;
    expect(s.building).toHaveLength(1);
    // advance until it finishes building and lands on the ready shelf
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    expect(s.ready.length).toBeGreaterThan(0);
    const launchRes = launchReady(s, s.ready[0].id);
    expect(launchRes.ok).toBe(true);
    s = launchRes.state;
    expect(s.launched).toHaveLength(1);
    for (let i = 0; i < 16; i++) s = advanceOneWeek(s);
    const lp = s.launched[0];
    expect(lp.unitsSold).toBeGreaterThan(0);
    expect(lp.revenueToDate).toBeGreaterThan(0);
  });

  it("records a launch-insight snapshot of the drivers behind the outcome", () => {
    let s = { ...newGame(42), cash: dollars(500_000) };
    s = startBuild(s, goodPhone(), 800, "none").state;
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    s = launchReady(s, s.ready[0].id).state;
    const ins = s.launched[0].insight;
    expect(ins).toBeDefined();
    // demand fit is a 0..100 read; competition factor is a 0..1 retained-share multiplier.
    expect(ins!.demandFit).toBeGreaterThanOrEqual(0);
    expect(ins!.demandFit).toBeLessThanOrEqual(100);
    expect(ins!.competitionFactor).toBeGreaterThan(0);
    expect(ins!.competitionFactor).toBeLessThanOrEqual(1);
    expect(ins!.priceFit).toBeGreaterThan(0);
    expect(ins!.hype).toBeGreaterThan(0);
    expect(ins!.matchingRivals).toBeGreaterThanOrEqual(0);
    expect(ins!.betterRivals).toBeGreaterThanOrEqual(0);
  });

  it("rejects building an incomplete product", () => {
    const s = newGame(1);
    const bad = { ...goodPhone(), tiers: { chip: 1 } };
    const res = startBuild(s, bad);
    expect(res.ok).toBe(false);
  });

  it("research deducts RP and raises the tier", () => {
    let s = newGame(7);
    for (let i = 0; i < 8; i++) s = advanceOneWeek(s); // accumulate RP
    const cost = rdRpCostFor(s, "chip")!;
    expect(s.researchPoints).toBeGreaterThanOrEqual(cost);
    const after = researchNext(s, "chip");
    expect(researchedTier(after, "chip")).toBe(2);
    expect(after.researchPoints).toBeCloseTo(s.researchPoints - cost, 5);
  });

  it("hiring adds payroll burn", () => {
    const s = newGame(9);
    const before = burn(s);
    const after = hireStaff(s, "engineer", 4, "Dev");
    expect(after.staff.length).toBe(s.staff.length + 1);
    expect(burn(after)).toBeGreaterThan(before);
  });

  it("weekly burn is deducted even with no products", () => {
    const s = hireStaff(newGame(3), "marketer", 5, "Mkt");
    const after = advanceOneWeek(s);
    expect(after.cash).toBeLessThan(s.cash);
  });
});

describe("B1 — recommended run can't bankrupt a fresh save during the build", () => {
  it("leaves at least the build-through safety reserve after paying the run upfront", () => {
    // A default new game (tight starting cash, garage rent) is the soft-lock case.
    const s = newGame(1234);
    const run = recommendedRun(s, goodPhone(), "none");
    const plan = planProduction(s, goodPhone(), run, "none");
    const reserve = buildSafetyReserve(s);
    const cashAfter = toDollars(s.cash) - toDollars(plan.totalUpfront);
    // Survive the build: cash left ≥ the reserve (= buildWeeks × burn + margin), within $1 rounding.
    expect(cashAfter + 1).toBeGreaterThanOrEqual(toDollars(reserve) - 1);
  });

  it("the recommended run survives the whole build without going bankrupt", () => {
    let s = newGame(77);
    const run = recommendedRun(s, goodPhone(), "none");
    s = startBuild(s, goodPhone(), run, "none").state;
    expect(s.bankrupt).toBe(false);
    // Tick through the entire build; the company must still be solvent when it lands ready.
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    expect(s.bankrupt).toBe(false);
    expect(toDollars(s.cash)).toBeGreaterThanOrEqual(0);
  });
});

describe("B4 — sellout fan-gain is bounded (no free fan-grind)", () => {
  /** Build the given run, tick through the build, launch, and return fans before/after launch.
   *  Demand is re-evaluated at launch time, so we read the actual metShare the engine used. */
  function launchWithRun(seed: number, fans: number, run: number) {
    let s = { ...newGame(seed), fans, cash: dollars(50_000_000) };
    s = startBuild(s, goodPhone(), run, "none").state;
    for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
    const before = s.fans;
    s = launchReady(s, s.ready[0].id).state;
    return { before, after: s.fans, lp: s.launched[0] };
  }

  it("a token under-supplied run that sells out is NOT rewarded with fan growth", () => {
    // Huge fanbase + minimum run → sells out while ignoring most of the market. Old behaviour
    // multiplied fans up for free; now a token run earns no buzz (and chronic undersupply costs a bit).
    const { before, after } = launchWithRun(5, 50_000, 50);
    expect(after).toBeLessThanOrEqual(before);
  });

  it("the sellout fan-bonus is bounded by selloutFanBonus (can't farm unbounded fans)", () => {
    // Worst case for the exploit: a huge fanbase that sells out. Whatever the verdict, the fan
    // change from a single launch can never exceed the legitimate maximum: the flat hit bump +
    // per-unit hit gain, then at most a selloutFanBonus multiplier. A token sellout that fails the
    // metShare gate is penalised instead — so the realised gain is strictly ≤ this analytic cap.
    const fb = BALANCE.fans;
    const fans = 50_000;
    const { before, after, lp } = launchWithRun(5, fans, 50);
    const maxHitFans = before + fb.gainOnHitFlat + (lp.totalUnits / 1000) * fb.gainPerHitUnitsK;
    const analyticCap = Math.round(maxHitFans * (1 + fb.selloutFanBonus));
    expect(after).toBeLessThanOrEqual(analyticCap);
  });

  it("fan pre-orders can't supply the entire market (cap forces some open-market demand)", () => {
    const s = { ...newGame(11), fans: 1_000_000, cash: dollars(50_000_000) };
    const plan = planProduction(s, goodPhone(), 1_000_000, "none");
    // Pre-orders are capped to a share of total demand, so market demand is always a real slice,
    // and pre-orders never equal total demand (the exploit's precondition).
    expect(plan.marketDemand).toBeGreaterThan(0);
    expect(plan.preOrders).toBeLessThan(plan.totalDemand);
    // Cap holds: pre-orders ≤ preOrderCap × total demand (+1 for integer rounding).
    expect(plan.preOrders).toBeLessThanOrEqual(BALANCE.fans.preOrderCap * plan.totalDemand + 1);
  });
});
