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
  sourcingExposure,
} from "./suppliers.ts";
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

describe("golden: an unset supplier is identical to standard and to pre-supplier behaviour", () => {
  it("unset == standard for cost and stats", () => {
    expect(toDollars(buildCost(product(undefined)))).toBe(toDollars(buildCost(product("standard"))));
    expect(computeStats(product(undefined))).toEqual(computeStats(product("standard")));
  });
});
