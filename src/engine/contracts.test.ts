import { describe, it, expect } from "vitest";
import {
  generateContract,
  contractDone,
  contractProgress,
  contractValue,
  rewardSummary,
  type ContractFacts,
} from "./contracts.ts";
import { dollars } from "./money.ts";

const facts = (over: Partial<ContractFacts> = {}): ContractFacts => ({
  revenue: 5_000_000, fans: 40_000, ships: 6, hits: 2, rank: 3, week: 60, ...over,
});

describe("contracts (rolling goal board)", () => {
  it("always targets AHEAD of the current standing — never pre-satisfied", () => {
    const f = facts();
    for (let salt = 0; salt < 40; salt++) {
      const c = generateContract(12345, salt, 3, f);
      expect(contractDone(c, f)).toBe(false);
      if (c.metric === "rank") expect(c.target).toBeLessThan(f.rank);
      else expect(c.target).toBeGreaterThan(contractValue(f, c.metric));
    }
  });

  it("is deterministic — same (seed, salt, era, facts) → identical contract", () => {
    const f = facts();
    expect(generateContract(999, 7, 2, f)).toEqual(generateContract(999, 7, 2, f));
  });

  it("only offers a rank goal when there's room to climb", () => {
    const atTop = facts({ rank: 1 });
    for (let salt = 0; salt < 40; salt++) {
      expect(generateContract(7, salt, 3, atTop).metric).not.toBe("rank");
    }
  });

  it("completes when the metric reaches the target; progress runs 0→1 from the baseline", () => {
    const f = facts({ ships: 6 });
    let c = generateContract(1, 0, 1, f);
    for (let salt = 0; c.metric !== "ships" && salt < 100; salt++) c = generateContract(1, salt, 1, f);
    expect(c.metric).toBe("ships"); // found a ships contract to exercise delta progress
    expect(contractProgress(c, f).frac).toBe(0);
    expect(contractProgress(c, f).done).toBe(false);
    const met = facts({ ships: c.target });
    expect(contractProgress(c, met).done).toBe(true);
    expect(contractProgress(c, met).frac).toBe(1);
  });

  it("scales rewards up with the era so late-game goals stay worthwhile", () => {
    // Compare a ships contract (fixed cash reward) across eras at the same salt.
    const shipsSalt = (() => { for (let s = 0; s < 100; s++) if (generateContract(2, s, 1, facts()).metric === "ships") return s; return 0; })();
    const e1 = generateContract(2, shipsSalt, 1, facts());
    const e4 = generateContract(2, shipsSalt, 4, facts());
    expect(e4.reward.cash).toBeGreaterThan(e1.reward.cash);
  });

  it("rewardSummary lists only the non-zero parts", () => {
    const s = rewardSummary({ cash: dollars(3_000), rep: 2, fans: 0 });
    expect(s).toContain("rep");
    expect(s).not.toContain("fans");
    expect(s).toContain("$3k");
  });
});
