import { describe, it, expect } from "vitest";
import { dollars } from "../engine/money.ts";
import type { Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  burn,
  buildWeeksFor,
  startBuild,
  launchReady,
  newGame,
  researchNext,
  researchedTier,
  hireStaff,
  rdRpCostFor,
} from "./gameState.ts";

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
