import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { buildCost, computeStats } from "./product.ts";
import {
  SUPPLIERS,
  SUPPLIER_LIST,
  DEFAULT_SUPPLIER_ID,
  supplierFor,
  unlockedSuppliers,
  isSupplierUnlocked,
  supplierCostMult,
  supplierQualityDelta,
  supplierLeadWeeks,
  supplierCrunchMult,
  supplierEthicsRepDelta,
  supplierEthicsLabel,
  sourcingExposure,
  supplierLoyaltyTier,
  supplierLoyaltyDiscount,
  buildsToNextTier,
  supplierLoyaltyProgress,
  contractTerm,
  contractDiscount,
} from "./suppliers.ts";
import { newGame, startBuild, effectiveUnitCost, recommendedRun, negotiateContract, contractSignFee, applyEventEffect, advanceOneWeek, launchReady } from "../state/gameState.ts";
import type { Product, SupplierId } from "./types.ts";

function product(supplierId?: SupplierId): Product {
  return {
    id: "p",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(499),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    supplierId,
  };
}

describe("supplier resolution", () => {
  it("defaults an unset / unknown id to the neutral standard supplier", () => {
    expect(supplierFor(undefined).id).toBe(DEFAULT_SUPPLIER_ID);
    expect(supplierFor("nope" as SupplierId).id).toBe(DEFAULT_SUPPLIER_ID);
  });

  it("standard is exactly neutral so it never changes existing behaviour", () => {
    const s = SUPPLIERS.standard;
    expect(s.costMult).toBe(1);
    expect(s.qualityDelta).toBe(0);
    expect(s.leadWeeks).toBe(0);
  });

  it("gates suppliers by era", () => {
    expect(unlockedSuppliers(1).every((s) => s.era === 1)).toBe(true);
    expect(unlockedSuppliers(4).length).toBe(SUPPLIER_LIST.length);
    expect(isSupplierUnlocked("vertex", 1)).toBe(false);
    expect(isSupplierUnlocked("vertex", 4)).toBe(true);
  });
});

describe("supplier effects on cost / quality / lead", () => {
  it("a cheaper supplier lowers unit cost; a premium one raises it", () => {
    const cheap = toDollars(buildCost(product("bargain")));
    const std = toDollars(buildCost(product("standard")));
    const premium = toDollars(buildCost(product("novacore")));
    expect(cheap).toBeLessThan(std);
    expect(premium).toBeGreaterThan(std);
    // cost tracks the multiplier (within rounding)
    expect(cheap / std).toBeCloseTo(SUPPLIERS.bargain.costMult, 1);
  });

  it("a premium supplier raises the quality stat; a bargain one lowers it", () => {
    const cheapQ = computeStats(product("bargain")).quality;
    const stdQ = computeStats(product("standard")).quality;
    const premiumQ = computeStats(product("novacore")).quality;
    expect(cheapQ).toBeLessThan(stdQ);
    expect(premiumQ).toBeGreaterThan(stdQ);
    expect(premiumQ - stdQ).toBe(SUPPLIERS.novacore.qualityDelta);
  });

  it("exposes per-product effect accessors", () => {
    expect(supplierCostMult(product("bargain"))).toBe(SUPPLIERS.bargain.costMult);
    expect(supplierQualityDelta(product("novacore"))).toBe(SUPPLIERS.novacore.qualityDelta);
    expect(supplierLeadWeeks(product("bargain"))).toBe(SUPPLIERS.bargain.leadWeeks);
  });

  it("quality stays clamped to 0..100 even with a negative delta", () => {
    const low: Product = { ...product("bargain"), tiers: { chip: 1 }, designTier: 1 };
    expect(computeStats(low).quality).toBeGreaterThanOrEqual(0);
  });
});

describe("supply-crunch exposure (P1.5)", () => {
  it("is neutral (1) with nothing sourcing, and falls back to the last shipped product", () => {
    expect(sourcingExposure([])).toBe(1);
    expect(sourcingExposure([], product("novacore"))).toBe(supplierCrunchMult(product("novacore")));
  });

  it("premium sourcing on active orders lowers exposure; bargain raises it", () => {
    expect(sourcingExposure([product("novacore")])).toBeLessThan(1);
    expect(sourcingExposure([product("bargain")])).toBeGreaterThan(1);
  });

  it("averages exposure across in-production builds (and ignores the fallback when building)", () => {
    const avg = (supplierCrunchMult(product("bargain")) + supplierCrunchMult(product("vertex"))) / 2;
    expect(sourcingExposure([product("bargain"), product("vertex")], product("standard"))).toBeCloseTo(avg, 5);
  });
});

describe("dual-sourcing (resilience hedge)", () => {
  it("adds a unit-cost premium and halves crunch exposure", () => {
    const single = product("novacore");
    const dual = { ...single, dualSource: true };
    expect(toDollars(buildCost(dual))).toBeGreaterThan(toDollars(buildCost(single)));
    expect(supplierCrunchMult(dual)).toBeCloseTo(supplierCrunchMult(single) * 0.5, 5);
    expect(sourcingExposure([dual])).toBeLessThan(sourcingExposure([single]));
  });
  it("does not touch quality or the supplier resolution", () => {
    expect(computeStats({ ...product("novacore"), dualSource: true }).quality).toBe(computeStats(product("novacore")).quality);
  });
});

describe("supplier relationships (loyalty)", () => {
  it("climbs tiers with build count and exposes the discount + next-tier countdown", () => {
    expect(supplierLoyaltyTier(0).name).toBe("New");
    expect(supplierLoyaltyDiscount(0)).toBe(0);
    expect(supplierLoyaltyTier(3).name).toBe("Trusted");
    expect(supplierLoyaltyDiscount(15)).toBeGreaterThan(supplierLoyaltyDiscount(3));
    expect(buildsToNextTier(0)).toBe(3);
    expect(buildsToNextTier(100)).toBeNull(); // top tier
    expect(supplierLoyaltyProgress(3)).toBe(0); // just entered Trusted
    expect(supplierLoyaltyProgress(5)).toBeCloseTo(0.5, 5); // halfway 3→7
    expect(supplierLoyaltyProgress(100)).toBe(1); // top tier
  });

  it("starting a build deepens the supplier relationship, and the discount cuts the next run's cost", () => {
    const s0 = { ...newGame(8), cash: dollars(50_000_000) };
    const phone: Product = {
      id: "p", name: "Aurora", category: "phone",
      tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 2 },
      finish: "aluminium", colorIndex: 0, price: dollars(499), designTier: 1,
      camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
      notch: "punch", supplierId: "novacore",
    };
    // Run enough builds to reach a discounting tier.
    let s = s0;
    const costBefore = toDollars(effectiveUnitCost(s, phone));
    for (let i = 0; i < 3; i++) s = startBuild(s, phone, recommendedRun(s, phone, "none"), "none").state;
    expect(s.supplierLoyalty?.novacore).toBe(3);
    expect(toDollars(effectiveUnitCost(s, phone))).toBeLessThan(costBefore);
  });

  it("a fresh game has no relationship, so cost is unchanged", () => {
    expect(newGame(8).supplierLoyalty ?? {}).toEqual({});
  });
});

describe("supplier contracts (negotiation hedge)", () => {
  const phone = (supplierId?: SupplierId): Product => ({
    id: "p", name: "Aurora", category: "phone",
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 2 },
    finish: "aluminium", colorIndex: 0, price: dollars(499), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch", supplierId,
  });

  it("the contract discount is the term base plus a reputation bonus, and longer terms cost more", () => {
    const annual = contractTerm("annual");
    expect(contractDiscount(annual, 0, 0.04)).toBeCloseTo(annual.baseDiscount, 5);
    expect(contractDiscount(annual, 100, 0.04)).toBeCloseTo(annual.baseDiscount + 0.04, 5);
    expect(toDollars(contractSignFee(2, contractTerm("annual")))).toBeGreaterThan(toDollars(contractSignFee(2, contractTerm("quarter"))));
  });

  it("negotiating locks a discount that cuts unit cost; it expires after the term", () => {
    const s0 = { ...newGame(8), era: 2, reputation: 80, cash: dollars(50_000_000) };
    const before = toDollars(effectiveUnitCost(s0, phone("novacore")));
    const s1 = negotiateContract(s0, "novacore", "quarter");
    expect(s1.supplierContracts?.novacore?.weeksLeft).toBe(13);
    expect(toDollars(s1.cash)).toBeLessThan(toDollars(s0.cash)); // paid the sign fee
    expect(toDollars(effectiveUnitCost(s1, phone("novacore")))).toBeLessThan(before);
    // run past the term → contract expires → back to spot pricing
    let s = s1;
    for (let i = 0; i < 14; i++) s = advanceOneWeek(s);
    expect(s.supplierContracts?.novacore?.weeksLeft ?? 0).toBe(0);
    expect(toDollars(effectiveUnitCost(s, phone("novacore")))).toBeCloseTo(before, -2);
  });

  it("a contracted supplier is immune to a supply crunch", () => {
    const base = { ...newGame(8), era: 2, reputation: 80, cash: dollars(50_000_000),
      building: [{ product: phone("bargain"), totalWeeks: 3, weeksElapsed: 0 }] };
    const hitNoContract = toDollars(base.cash) - toDollars(applyEventEffect(base, { kind: "supplyCrunch", cash: 8_000 }, 10, "crunch", "negative").cash);
    const contracted = negotiateContract(base, "bargain", "quarter");
    const hitContracted = toDollars(contracted.cash) - toDollars(applyEventEffect(contracted, { kind: "supplyCrunch", cash: 8_000 }, 10, "crunch", "negative").cash);
    expect(hitNoContract).toBeGreaterThan(0);
    expect(hitContracted).toBe(0); // price-locked → crunch-proof
  });

  it("is a no-op for an era-locked supplier or when the fee is unaffordable", () => {
    const poor = { ...newGame(8), era: 1, cash: dollars(10) };
    expect(negotiateContract(poor, "novacore", "annual").supplierContracts ?? {}).toEqual({}); // can't afford
    expect(negotiateContract({ ...poor, cash: dollars(50_000_000) }, "vertex", "quarter").supplierContracts ?? {}).toEqual({}); // vertex is era 4
  });
});

describe("supplier ethics (sustainability axis)", () => {
  it("rep delta is negative for cheap sourcing, zero for standard, positive for premium", () => {
    expect(supplierEthicsRepDelta(product("bargain"))).toBeLessThan(0);
    expect(supplierEthicsRepDelta(product("standard"))).toBe(0);
    expect(supplierEthicsRepDelta(product("vertex"))).toBeGreaterThan(0);
  });

  it("labels the rating", () => {
    expect(supplierEthicsLabel(88)).toBe("Exemplary");
    expect(supplierEthicsLabel(65)).toBe("Responsible");
    expect(supplierEthicsLabel(55)).toBe("Standard");
    expect(supplierEthicsLabel(25)).toBe("Exploitative");
  });

  it("a launch with responsible sourcing ends with more reputation than the same launch sourced cheap", () => {
    // Maxed, identical products → same verdict; the only reputation difference is the ethics nudge.
    const maxed = (supplierId: SupplierId): Product => ({
      id: `r-${supplierId}`, name: "Flagship", category: "phone",
      tiers: { chip: 6, display: 6, battery: 6, materials: 5, software: 5, camera: 4 },
      finish: "titanium", colorIndex: 0, price: dollars(999), designTier: 3,
      camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
      notch: "punch", plannedUnits: 5000, supplierId,
    });
    const base = { ...newGame(8), era: 4, reputation: 50 };
    const repPremium = launchReady({ ...base, ready: [maxed("vertex")] }, "r-vertex").state.reputation;
    const repCheap = launchReady({ ...base, ready: [maxed("bargain")] }, "r-bargain").state.reputation;
    expect(repPremium).toBeGreaterThan(repCheap);
  });
});

describe("golden: an unset supplier is identical to standard and to pre-supplier behaviour", () => {
  it("unset == standard for cost and stats", () => {
    expect(toDollars(buildCost(product(undefined)))).toBe(toDollars(buildCost(product("standard"))));
    expect(computeStats(product(undefined))).toEqual(computeStats(product("standard")));
  });
});
