import { describe, it, expect } from "vitest";
import {
  MOONSHOTS,
  MOONSHOT_COOLDOWN_WEEKS,
  MOONSHOT_PITY_REFUND,
  moonshotBonuses,
  moonshotById,
  moonshotCooldownLeft,
  moonshotIndex,
  moonshotRefund,
  moonshotRoll,
  resolveMoonshot,
} from "./moonshots.ts";

describe("moonshots — catalog integrity", () => {
  it("has ~6 moonshots with unique ids", () => {
    expect(MOONSHOTS.length).toBeGreaterThanOrEqual(6);
    const ids = MOONSHOTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is era-gated: every moonshot is era 3+, and at least one is era 4+", () => {
    expect(MOONSHOTS.every((m) => m.era >= 3)).toBe(true);
    expect(MOONSHOTS.some((m) => m.era >= 4)).toBe(true);
  });

  it("states plain odds inside [0.30, 0.70]", () => {
    for (const m of MOONSHOTS) {
      expect(m.successChance).toBeGreaterThanOrEqual(0.3);
      expect(m.successChance).toBeLessThanOrEqual(0.7);
    }
  });

  it("charges a steep RP cost — a real multiple of a big late-game project (>340 RP)", () => {
    for (const m of MOONSHOTS) expect(m.rpCost).toBeGreaterThan(340);
  });

  it("every moonshot carries a labelled, wireable reward", () => {
    for (const m of MOONSHOTS) {
      expect(m.reward.label.length).toBeGreaterThan(0);
      const r = m.reward;
      const hasEffect =
        (r.designCeiling ?? 0) > 0 ||
        (r.epBudget ?? 0) > 0 ||
        (r.buildCostMult ?? 0) > 0 ||
        (r.rpMult ?? 0) > 0 ||
        (r.stat && Object.keys(r.stat).length > 0) ||
        (r.fans ?? 0) > 0 ||
        (r.reputation ?? 0) > 0;
      expect(hasEffect).toBe(true);
    }
  });
});

describe("moonshots — refund + cooldown math", () => {
  it("refunds a floored 25% pity on failure", () => {
    expect(MOONSHOT_PITY_REFUND).toBe(0.25);
    for (const m of MOONSHOTS) {
      expect(moonshotRefund(m.rpCost)).toBe(Math.floor(m.rpCost * 0.25));
      expect(moonshotRefund(m.rpCost)).toBeLessThan(m.rpCost); // most of the RP burns
    }
    expect(moonshotRefund(460)).toBe(115);
  });

  it("cooldown counts down from the last failed attempt and floors at 0", () => {
    expect(moonshotCooldownLeft(100, undefined)).toBe(0); // never attempted → ready
    expect(moonshotCooldownLeft(100, 100)).toBe(MOONSHOT_COOLDOWN_WEEKS); // just failed
    expect(moonshotCooldownLeft(100 + MOONSHOT_COOLDOWN_WEEKS - 1, 100)).toBe(1);
    expect(moonshotCooldownLeft(100 + MOONSHOT_COOLDOWN_WEEKS, 100)).toBe(0); // exactly off cooldown
    expect(moonshotCooldownLeft(500, 100)).toBe(0); // long past → ready
  });
});

describe("moonshots — resolution determinism (derived hash, salt 307 + per-moonshot sub-salt)", () => {
  it("the same (seed, week, moonshot) always resolves the same way", () => {
    for (const m of MOONSHOTS) {
      for (const [seed, week] of [[123, 40], [999, 77], [7, 300]] as const) {
        expect(resolveMoonshot(seed, week, m.id)).toBe(resolveMoonshot(seed, week, m.id));
        expect(moonshotRoll(seed, week, m.id)).toBe(moonshotRoll(seed, week, m.id));
      }
    }
  });

  it("different weeks can produce different outcomes (it isn't a constant)", () => {
    const id = MOONSHOTS[0].id;
    const seed = 4242;
    const results = new Set<boolean>();
    for (let w = 30; w < 120; w++) results.add(resolveMoonshot(seed, w, id));
    expect(results.size).toBe(2); // both success and failure occur across weeks
  });

  it("two moonshots on the same seed+week roll independently (sub-salt folds the index)", () => {
    // The per-moonshot index (3070 + index) must make the streams distinct, not a shared roll.
    expect(moonshotIndex(MOONSHOTS[0].id)).not.toBe(moonshotIndex(MOONSHOTS[1].id));
    const rolls = MOONSHOTS.map((m) => moonshotRoll(555, 60, m.id));
    expect(new Set(rolls).size).toBe(MOONSHOTS.length); // all distinct
  });

  it("the empirical hit rate tracks the stated odds over many weeks (honest odds)", () => {
    const id = "quantumCluster"; // 45%
    const chance = moonshotById(id)!.successChance;
    let hits = 0;
    const N = 4000;
    for (let w = 0; w < N; w++) if (resolveMoonshot(20260718, w, id)) hits++;
    expect(hits / N).toBeGreaterThan(chance - 0.05);
    expect(hits / N).toBeLessThan(chance + 0.05);
  });
});

describe("moonshots — bonus aggregation", () => {
  it("empty / undefined won → the all-zero neutral bonus", () => {
    const zero = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0, epBudget: 0, stat: {} };
    expect(moonshotBonuses([])).toEqual(zero);
    expect(moonshotBonuses(undefined)).toEqual(zero);
  });

  it("a won moonshot contributes its reward on the right axis", () => {
    expect(moonshotBonuses(["neuralLattice"]).designCeiling).toBe(1);
    expect(moonshotBonuses(["genFoundry"]).epBudget).toBe(3);
    expect(moonshotBonuses(["zeroWaste"]).buildCostMult).toBeCloseTo(0.08, 10);
    expect(moonshotBonuses(["quantumCluster"]).rpMult).toBeCloseTo(0.25, 10);
    expect(moonshotBonuses(["signatureSemantics"]).stat).toEqual({ design: 3, ecosystem: 3 });
    // A one-time windfall is NOT part of the persistent aggregation.
    const cultural = moonshotBonuses(["culturalMoment"]);
    expect(cultural.designCeiling + cultural.epBudget + cultural.rpMult + cultural.buildCostMult).toBe(0);
    expect(cultural.stat).toEqual({});
  });

  it("multiple wins sum across axes", () => {
    const b = moonshotBonuses(["neuralLattice", "genFoundry", "zeroWaste"]);
    expect(b.designCeiling).toBe(1);
    expect(b.epBudget).toBe(3);
    expect(b.buildCostMult).toBeCloseTo(0.08, 10);
  });

  it("ignores unknown ids", () => {
    expect(moonshotBonuses(["nope", "neuralLattice"]).designCeiling).toBe(1);
  });
});
