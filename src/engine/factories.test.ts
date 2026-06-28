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
} from "./factories.ts";
import { newGame, planProduction, buildWeeksFor, effectiveUnitCost, toolingCost, type GameState } from "../state/gameState.ts";
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
