// Design Budget (feature #1) — unit coverage for the pure EP model: cost mapping, the era base table,
// raise stacking, and the canAfford (epFits) logic. All pure, no GameState.
import { describe, it, expect } from "vitest";
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import {
  slotEp,
  productEp,
  epBudgetBase,
  epRaisesEarned,
  epBudget,
  epFits,
  EP_BUDGET_RAISES,
} from "./designBudget.ts";
import { dollars } from "./money.ts";
import type { Product, CategoryId } from "./types.ts";

function phone(tiers: Partial<Product["tiers"]>): Product {
  return {
    id: "p", name: "Aurora", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1, ...tiers },
    finish: "aluminium", colorIndex: 0, price: dollars(499), designTier: 1,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

describe("EP cost mapping (slotEp)", () => {
  it("a chosen tier costs its own tier number in EP (T1=1 … T7=7)", () => {
    expect(slotEp(1)).toBe(1);
    expect(slotEp(2)).toBe(2);
    expect(slotEp(5)).toBe(5);
    expect(slotEp(7)).toBe(7);
  });
  it("an unset / non-finite / sub-1 tier costs 0", () => {
    expect(slotEp(undefined)).toBe(0);
    expect(slotEp(0)).toBe(0);
    expect(slotEp(NaN)).toBe(0);
    expect(slotEp(-3)).toBe(0);
  });
});

describe("productEp sums only the category's applicable slots", () => {
  it("an all-T1 phone spends 1 EP per slot (6 slots → 6 EP)", () => {
    expect(productEp(phone({}))).toBe(CATEGORIES.phone.slots.length);
    expect(productEp(phone({}))).toBe(6);
  });
  it("raising slots raises EP by the tier delta", () => {
    // chip→2 (+1), display→4 (+3), battery→3 (+2): 6 + 1 + 3 + 2 = 12
    expect(productEp(phone({ chip: 2, display: 4, battery: 3 }))).toBe(12);
  });
  it("a maxed era-appropriate phone matches the hand-computed per-era ceiling", () => {
    // Era-5 reachable maxes: chip7 display7 battery7 materials6 software6 camera6 = 39
    const maxed = phone({ chip: 7, display: 7, battery: 7, materials: 6, software: 6, camera: 6 });
    expect(productEp(maxed)).toBe(39);
  });
  it("a slot NOT in the category is ignored (a 3-slot desktop only counts its 3 slots)", () => {
    const desktop: Product = { ...phone({ chip: 5, materials: 5, software: 5, display: 7, battery: 7 }), category: "desktop" as CategoryId };
    // desktop slots are chip, materials, software → 5+5+5 = 15; the (irrelevant) display/battery are ignored.
    expect(productEp(desktop)).toBe(15);
  });
});

describe("era base budget table", () => {
  it("reads the BALANCE table by era (index = era − 1)", () => {
    const t = BALANCE.designBudget.baseByEra;
    for (let era = 1; era <= t.length; era++) expect(epBudgetBase(era)).toBe(t[era - 1]);
  });
  it("clamps out-of-range eras to the table's ends", () => {
    const t = BALANCE.designBudget.baseByEra;
    expect(epBudgetBase(0)).toBe(t[0]);
    expect(epBudgetBase(99)).toBe(t[t.length - 1]);
  });
  it("is non-decreasing across eras (the cap only ever loosens)", () => {
    const t = BALANCE.designBudget.baseByEra;
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });
});

describe("raise stacking (epRaisesEarned / epBudget)", () => {
  it("no raise projects → base only", () => {
    expect(epRaisesEarned([])).toBe(0);
    expect(epBudget(1, [])).toBe(epBudgetBase(1));
  });
  it("each raise project adds its EP, and they stack", () => {
    expect(epRaisesEarned(["prototypeBench"])).toBe(2);
    expect(epRaisesEarned(["prototypeBench", "componentStandards"])).toBe(4);
    // Full stack = the sum of every raise (fully-invested company).
    const all = EP_BUDGET_RAISES.map((r) => r.project);
    const total = EP_BUDGET_RAISES.reduce((a, r) => a + r.ep, 0);
    expect(epRaisesEarned(all)).toBe(total);
    expect(total).toBe(12);
  });
  it("unrelated completed projects grant nothing", () => {
    expect(epRaisesEarned(["qaLab", "brandStudio", "loyaltyProgram"])).toBe(0);
  });
  it("a fully-invested era-5 budget can (nearly) max a phone; a fresh one cannot", () => {
    const all = EP_BUDGET_RAISES.map((r) => r.project);
    // Fully invested E5: 28 + 12 = 40 ≥ 39 max → can fully max.
    expect(epBudget(5, all)).toBeGreaterThanOrEqual(39);
    // Fresh E5: 28 < 39 → cannot max.
    expect(epBudget(5, [])).toBeLessThan(39);
    // Fresh E1: 8 < 11 (era-1 phone max) → forces sacrifices.
    expect(epBudget(1, [])).toBeLessThan(11);
  });
});

describe("epFits (canAfford)", () => {
  it("at/under budget fits; over budget does not", () => {
    // Era 1 base 8. All-T1 phone = 6 EP fits; all-T2 phone = 12 EP does not.
    expect(epFits(phone({}), 1, [])).toBe(true);
    expect(epFits(phone({ chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 2 }), 1, [])).toBe(false);
  });
  it("a raise can make a previously-over build fit", () => {
    const build = phone({ chip: 2, display: 2 }); // 6 + 1 + 1 = 8 EP
    expect(productEp(build)).toBe(8);
    expect(epFits(build, 1, [])).toBe(true); // exactly at the era-1 base of 8
    const over = phone({ chip: 3, display: 2 }); // 9 EP
    expect(epFits(over, 1, [])).toBe(false);
    expect(epFits(over, 1, ["prototypeBench"])).toBe(true); // +2 → budget 10 ≥ 9
  });
});
