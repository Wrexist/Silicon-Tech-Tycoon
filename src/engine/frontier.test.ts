import { describe, it, expect } from "vitest";
import { frontierCost, frontierBonuses, frontierBandName, FRONTIER_BASE_COST } from "./frontier.ts";

describe("frontier tech ladder", () => {
  it("undefined / zero tier is a pure no-op (byte-identical to no frontier at all)", () => {
    const zero = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 };
    expect(frontierBonuses(undefined)).toEqual(zero);
    expect(frontierBonuses(0)).toEqual(zero);
    expect(frontierCost(undefined)).toBe(FRONTIER_BASE_COST);
  });

  it("cost escalates every tier (an ever-rising Legacy-Point sink)", () => {
    expect(frontierCost(0)).toBe(6);
    expect(frontierCost(1)).toBe(8);
    expect(frontierCost(2)).toBe(10);
    expect(frontierCost(10)).toBe(26);
    // strictly increasing
    for (let t = 0; t < 50; t++) expect(frontierCost(t + 1)).toBeGreaterThan(frontierCost(t));
  });

  it("bonus scales up with tier and stays research-forward", () => {
    const b5 = frontierBonuses(5);
    expect(b5.rpMult).toBeCloseTo(0.25, 5);
    expect(b5.hype).toBeCloseTo(0.10, 5);
    expect(b5.buildCostMult).toBeCloseTo(0.05, 5);
    // research is the biggest slice at every tier
    for (let t = 1; t <= 20; t++) {
      const b = frontierBonuses(t);
      expect(b.rpMult).toBeGreaterThan(b.hype);
      expect(b.hype).toBeGreaterThan(b.buildCostMult);
    }
  });

  it("design ceiling bumps once every 10 tiers", () => {
    expect(frontierBonuses(9).designCeiling).toBe(0);
    expect(frontierBonuses(10).designCeiling).toBe(1);
    expect(frontierBonuses(25).designCeiling).toBe(2);
  });

  it("band name grows every 5 tiers and never overflows the table", () => {
    expect(frontierBandName(0)).toBe("Frontier");
    expect(frontierBandName(1)).toBe("Frontier");
    expect(frontierBandName(6)).toBe("Deep Frontier");
    expect(frontierBandName(11)).toBe("Quantum Frontier");
    expect(frontierBandName(9999)).toBe("Singularity Frontier"); // clamps to the last band
  });
});
