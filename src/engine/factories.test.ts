import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "./money.ts";
import {
  FACTORIES,
  FACTORY_LIST,
  DEFAULT_FACTORY_ID,
  factoryFor,
  unlockedFactories,
  isFactoryUnlocked,
  overtimeUnits,
  resolveCapacity,
  availableFactories,
  acquirableFactories,
  totalFactoryUpkeep,
} from "./factories.ts";
import { computeStats } from "./product.ts";
import { newGame, planProduction, capacityPlan, buildWeeksFor, effectiveUnitCost, toolingCost, acquireFactory, burn, type GameState } from "../state/gameState.ts";
import type { Product, FactoryId } from "./types.ts";

function phone(factoryId?: FactoryId): Product {
  return {
    id: "p",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 4, display: 4, battery: 4, materials: 4, software: 4, camera: 3 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(499),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    factoryId,
  };
}

describe("factory resolution + gating", () => {
  it("defaults an unset / unknown id to standard", () => {
    expect(factoryFor(undefined).id).toBe(DEFAULT_FACTORY_ID);
    expect(factoryFor("nope" as FactoryId).id).toBe(DEFAULT_FACTORY_ID);
  });

  it("standard is neutral with unlimited capacity", () => {
    const f = FACTORIES.standard;
    expect(f.toolingMult).toBe(1);
    expect(f.unitMult).toBe(1);
    expect(f.speedMult).toBe(1);
    expect(f.capacityPerWeek).toBe(Infinity);
  });

  it("gates factories by era", () => {
    expect(unlockedFactories(1).every((f) => f.era === 1)).toBe(true);
    expect(unlockedFactories(3).length).toBe(FACTORY_LIST.length);
    expect(isFactoryUnlocked("apex", 1)).toBe(false);
    expect(isFactoryUnlocked("apex", 3)).toBe(true);
  });
});

describe("overtime math", () => {
  it("is zero within capacity and with an unlimited line", () => {
    expect(overtimeUnits(1000, Infinity, 3)).toBe(0);
    expect(overtimeUnits(3000, 1500, 3)).toBe(0); // 1500×3 = 4500 ≥ 3000
  });
  it("counts only the units beyond capacity × weeks", () => {
    expect(overtimeUnits(6000, 1500, 3)).toBe(1500); // 6000 − 4500
  });
});

describe("factory effects through the engine", () => {
  const s: GameState = { ...newGame(8), legacy: 1, launched: [], building: [], ready: [] }; // legacy 1 so buildWeeksFor isn't on the first-build fast path

  it("a budget line is cheaper to tool and per-unit; a rapid line builds faster", () => {
    expect(toDollars(toolingCost(s, phone("eastwind")))).toBeLessThan(toDollars(toolingCost(s, phone("standard"))));
    expect(toDollars(effectiveUnitCost(s, phone("eastwind")))).toBeLessThan(toDollars(effectiveUnitCost(s, phone("standard"))));
    expect(buildWeeksFor(s, phone("kairos"))).toBeLessThanOrEqual(buildWeeksFor(s, phone("standard")));
  });

  it("a big run on a capacity-limited line incurs an overtime cost; unlimited lines never do", () => {
    const big = 60_000;
    const budget = planProduction(s, phone("eastwind"), big, "none");
    const std = planProduction(s, phone("standard"), big, "none");
    expect(budget.overCapacity).toBe(true);
    expect(toDollars(budget.overtimeCost)).toBeGreaterThan(0);
    expect(std.overCapacity).toBe(false);
    expect(toDollars(std.overtimeCost)).toBe(0);
  });
});

describe("capacity strategies (P3)", () => {
  const opts = { plannedUnits: 6000, capacityPerWeek: 1500, assemblyWeeks: 3, overtimeSurcharge: 0.6, defectMaxPenalty: 18 };
  it("overtime keeps the schedule and surcharges the excess", () => {
    const o = resolveCapacity({ ...opts, strategy: "overtime" });
    expect(o.buildWeeks).toBe(3);
    expect(o.overUnits).toBe(1500);
    expect(o.overtimeFraction).toBe(0.6);
    expect(o.qualityPenalty).toBe(0);
  });
  it("stretch extends the schedule to fit capacity, no surcharge", () => {
    const o = resolveCapacity({ ...opts, strategy: "stretch" });
    expect(o.buildWeeks).toBe(4); // ceil(6000/1500)
    expect(o.overtimeFraction).toBe(0);
  });
  it("defects keeps schedule + cost but hits quality", () => {
    const o = resolveCapacity({ ...opts, strategy: "defects" });
    expect(o.buildWeeks).toBe(3);
    expect(o.overtimeFraction).toBe(0);
    expect(o.qualityPenalty).toBeGreaterThan(0);
  });
  it("stretch stays finite if a factory is misconfigured to zero capacity (defensive guard)", () => {
    // Not reachable with real factory constants (overUnits > 0 implies finite capacity), but a bad
    // capacityPerWeek of 0 must not divide into Infinity buildWeeks. The floored divisor keeps it finite.
    const o = resolveCapacity({ ...opts, capacityPerWeek: 0, strategy: "stretch" });
    expect(Number.isFinite(o.buildWeeks)).toBe(true);
    expect(o.buildWeeks).toBeGreaterThanOrEqual(opts.assemblyWeeks);
  });
  it("is a clean no-op within capacity regardless of strategy", () => {
    for (const strategy of ["overtime", "stretch", "defects"] as const) {
      const o = resolveCapacity({ ...opts, plannedUnits: 1000, strategy });
      expect(o).toEqual({ overUnits: 0, buildWeeks: 3, overtimeFraction: 0, qualityPenalty: 0 });
    }
  });

  it("threads through planProduction: stretch lengthens buildWeeks; defects bakes a quality hit", () => {
    const s: GameState = { ...newGame(8), legacy: 1 };
    const over = planProduction(s, { ...phone("eastwind"), capacityStrategy: "overtime" }, 60_000, "none");
    const stretch = planProduction(s, { ...phone("eastwind"), capacityStrategy: "stretch" }, 60_000, "none");
    expect(stretch.buildWeeks).toBeGreaterThan(over.buildWeeks);
    expect(toDollars(stretch.overtimeCost)).toBe(0);

    const penalty = capacityPlan(s, { ...phone("eastwind"), capacityStrategy: "defects" }, 60_000).qualityPenalty;
    expect(penalty).toBeGreaterThan(0);
    // Use a mid-tier product so the quality stat isn't already clamped at 100 (where a hit hides).
    const mid: Product = { ...phone("eastwind"), tiers: { chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 1 } };
    const cleanQ = computeStats(mid).quality;
    const defectQ = computeStats({ ...mid, defectPenalty: penalty }).quality;
    expect(defectQ).toBe(Math.max(0, cleanQ - penalty));
  });
});

describe("owned lines (P3)", () => {
  it("contract lines are always available; owned lines only after acquisition", () => {
    expect(availableFactories(3).some((f) => f.id === "homeline")).toBe(false);
    expect(availableFactories(3, ["homeline"]).some((f) => f.id === "homeline")).toBe(true);
    expect(acquirableFactories(3).map((f) => f.id)).toContain("homeline");
    expect(acquirableFactories(3, ["homeline"]).map((f) => f.id)).not.toContain("homeline");
  });
  it("sums weekly upkeep across owned lines", () => {
    expect(toDollars(totalFactoryUpkeep([]))).toBe(0);
    expect(toDollars(totalFactoryUpkeep(["homeline"]))).toBe(toDollars(FACTORIES.homeline.weeklyUpkeep));
  });

  it("acquireFactory buys the line, charges cash, and folds upkeep into weekly burn", () => {
    const rich: GameState = { ...newGame(8), era: 3, cash: dollars(20_000_000) };
    const before = toDollars(burn(rich));
    const s2 = acquireFactory(rich, "homeline");
    expect(s2.ownedFactories).toContain("homeline");
    expect(toDollars(s2.cash)).toBe(toDollars(rich.cash) - toDollars(FACTORIES.homeline.acquireCost));
    expect(toDollars(burn(s2))).toBeCloseTo(before + toDollars(FACTORIES.homeline.weeklyUpkeep), 0);
  });

  it("acquireFactory is a no-op when unaffordable, era-locked, or already owned", () => {
    const rich: GameState = { ...newGame(8), era: 3, cash: dollars(20_000_000) };
    expect(acquireFactory({ ...rich, cash: dollars(10) }, "homeline").ownedFactories).toEqual([]);
    expect(acquireFactory({ ...newGame(8), era: 1, cash: dollars(20_000_000) }, "homeline").ownedFactories).toEqual([]);
    const owned = acquireFactory(rich, "homeline");
    expect(acquireFactory(owned, "homeline").ownedFactories).toEqual(["homeline"]); // unchanged
  });
});

describe("golden: an unset factory == standard == pre-factory behaviour", () => {
  const s: GameState = { ...newGame(8), legacy: 1 };
  it("cost, weeks and plan match between unset and standard", () => {
    expect(toDollars(effectiveUnitCost(s, phone(undefined)))).toBe(toDollars(effectiveUnitCost(s, phone("standard"))));
    expect(buildWeeksFor(s, phone(undefined))).toBe(buildWeeksFor(s, phone("standard")));
    const a = planProduction(s, phone(undefined), 50_000, "none");
    const b = planProduction(s, phone("standard"), 50_000, "none");
    expect(toDollars(a.totalUpfront)).toBe(toDollars(b.totalUpfront));
    expect(a.overCapacity).toBe(false);
  });
});
