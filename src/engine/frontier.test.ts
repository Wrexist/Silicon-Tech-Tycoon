import { describe, it, expect } from "vitest";
import {
  frontierCost, frontierBonuses, frontierBandName, FRONTIER_BASE_COST,
  FRONTIER_LANES, laneTotal, frontierBandsCrossed, frontierBandUnlockAt, nextFrontierBandUnlock,
} from "./frontier.ts";

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

describe("frontier lanes & band unlocks (feature #6)", () => {
  it("no lanes → EXACTLY the legacy flat bonus (existing saves are byte-identical)", () => {
    for (const t of [0, 1, 5, 10, 25]) {
      expect(frontierBonuses(t)).toEqual(frontierBonuses(t, undefined));
      expect(frontierBonuses(t, {})).toEqual(frontierBonuses(t)); // empty lanes = no lanes
    }
    // still research-forward on the legacy path
    expect(frontierBonuses(5).rpMult).toBeCloseTo(0.25, 5);
  });

  it("each lane pushes its own axis harder than the generalist tier did", () => {
    // 4 research tiers vs 4 market tiers vs 4 ops tiers — each dominates its own axis.
    const research = frontierBonuses(4, { research: 4 });
    const market = frontierBonuses(4, { market: 4 });
    const ops = frontierBonuses(4, { operations: 4 });
    expect(research.rpMult).toBeGreaterThan(market.rpMult);
    expect(market.hype).toBeGreaterThan(research.hype);
    expect(ops.buildCostMult).toBeGreaterThan(research.buildCostMult);
    // a specialist beats the old flat tier on its own axis
    expect(research.rpMult).toBeGreaterThan(frontierBonuses(4).rpMult);
  });

  it("the design lane raises the ceiling every 4 tiers", () => {
    expect(frontierBonuses(3, { design: 3 }).designCeiling).toBe(0);
    expect(frontierBonuses(4, { design: 4 }).designCeiling).toBeGreaterThanOrEqual(1);
  });

  it("legacy tiers keep the flat bonus; new lane tiers stack on top", () => {
    // A save with 5 pre-lane tiers that then buys a 6th into research: the 5 keep flat, the 6th adds lane.
    const mixed = frontierBonuses(6, { research: 1 });
    const flat5 = frontierBonuses(5); // the pre-lane portion
    expect(mixed.rpMult).toBeGreaterThan(flat5.rpMult); // strictly more than just the legacy tiers
  });

  it("band boundaries are crossed every 5 tiers and grant a one-time unlock", () => {
    expect(frontierBandsCrossed(4)).toBe(0);
    expect(frontierBandsCrossed(5)).toBe(1);
    expect(frontierBandsCrossed(12)).toBe(2);
    // crossing tier 5 adds the first band's bonus ON TOP of lane bonuses
    const below = frontierBonuses(4, { research: 4 });
    const at = frontierBonuses(5, { research: 5 });
    // band-1 unlock is +1 design ceiling — appears exactly at tier 5
    expect(below.designCeiling).toBe(0);
    expect(at.designCeiling).toBe(1);
    // the unlock table cycles endlessly (never throws, always names a next one)
    expect(frontierBandUnlockAt(9).name.length).toBeGreaterThan(0);
    expect(nextFrontierBandUnlock(7).tier).toBe(10);
  });

  it("laneTotal sums allocations and every lane has display copy", () => {
    expect(laneTotal(undefined)).toBe(0);
    expect(laneTotal({ research: 2, market: 3 })).toBe(5);
    expect(FRONTIER_LANES).toHaveLength(4);
    for (const l of FRONTIER_LANES) {
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.perTierLabel.length).toBeGreaterThan(0);
    }
  });
});
