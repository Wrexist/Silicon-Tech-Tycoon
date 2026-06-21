import { describe, it, expect } from "vitest";
import { PERKS, activePerks, perkBonuses, nextPerk } from "./perks.ts";

describe("founder perks", () => {
  it("level 0 (first playthrough) grants no perks", () => {
    expect(activePerks(0)).toEqual([]);
    expect(perkBonuses(0)).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 });
  });

  it("each prestige unlocks the next perk in order, cumulatively", () => {
    expect(activePerks(1).map((p) => p.id)).toEqual([PERKS[0].id]);
    expect(activePerks(3)).toHaveLength(3);
    // bonuses accumulate
    const b3 = perkBonuses(3);
    expect(b3.designCeiling).toBe(1); // only the first perk is a ceiling perk in the first 3
    expect(b3.hype).toBeCloseTo(0.15);
    expect(b3.rpMult).toBeCloseTo(0.15);
  });

  it("clamps at the catalog size (no perks beyond the ladder)", () => {
    expect(activePerks(999)).toHaveLength(PERKS.length);
    const all = perkBonuses(999);
    const sum = PERKS.reduce(
      (a, p) => ({
        designCeiling: a.designCeiling + (p.bonus.designCeiling ?? 0),
        hype: a.hype + (p.bonus.hype ?? 0),
        rpMult: a.rpMult + (p.bonus.rpMult ?? 0),
        buildCostMult: a.buildCostMult + (p.bonus.buildCostMult ?? 0),
      }),
      { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 },
    );
    expect(all.designCeiling).toBe(sum.designCeiling);
    expect(all.hype).toBeCloseTo(sum.hype);
    expect(all.rpMult).toBeCloseTo(sum.rpMult);
    // buildCostMult is the one capped dimension — never exceeds the 40% hard ceiling.
    expect(all.buildCostMult).toBeLessThanOrEqual(0.4);
    expect(all.buildCostMult).toBeCloseTo(Math.min(0.4, sum.buildCostMult));
  });

  it("the build-cost reduction is hard-capped so manufacturing is never free", () => {
    // Even with an absurd prestige level, the reduction can't exceed 40% (cost stays ≥ 60%).
    expect(perkBonuses(9999).buildCostMult).toBeLessThanOrEqual(0.4);
    expect(perkBonuses(9999).buildCostMult).toBeGreaterThan(0);
  });

  it("nextPerk previews the upcoming unlock, undefined when maxed", () => {
    expect(nextPerk(0)).toBe(PERKS[0]);
    expect(nextPerk(2)).toBe(PERKS[2]);
    expect(nextPerk(PERKS.length)).toBeUndefined();
  });

  it("handles malformed level input safely", () => {
    expect(activePerks(-5)).toEqual([]);
    expect(activePerks(NaN)).toEqual([]);
  });
});
