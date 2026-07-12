import { describe, it, expect } from "vitest";
import { eraModifier, eraRuleSummary } from "./eras.ts";
import { BALANCE } from "./balance.ts";

describe("era-distinct mechanics (Epic D)", () => {
  it("the Garage + Growth eras are the unchanged baseline (all 1.0)", () => {
    for (const era of [1, 2]) {
      const m = eraModifier(era);
      expect(m.marketingHype).toBe(1);
      expect(m.ecosystemRate).toBe(1);
      expect(m.demandVariance).toBe(1);
    }
    expect(eraRuleSummary(1)).toBeNull();
  });

  it("the Growth era (C1) surfaces its real change — the competition ramp + a bigger market", () => {
    // Era 2 has no eraModifier delta, but competition jumps 0.25→1.0 and the market grows; the rule
    // summary now says so instead of reading as an identical era.
    const s = eraRuleSummary(2);
    expect(s).not.toBeNull();
    expect(s).toMatch(/rivals|contest/i);
    expect(s).toMatch(/bigger/i);
  });

  it("the Platform era amplifies the ecosystem economy + marketing", () => {
    const m = eraModifier(3);
    expect(m.ecosystemRate).toBeGreaterThan(1);
    expect(m.marketingHype).toBeGreaterThan(1);
    expect(m.demandVariance).toBe(1); // still steady demand
    expect(eraRuleSummary(3)).toContain("ecosystem");
  });

  it("the AI era is the most volatile, hype-driven, ecosystem-heavy regime", () => {
    const ai = eraModifier(4);
    const platform = eraModifier(3);
    expect(ai.demandVariance).toBeGreaterThan(1);
    expect(ai.ecosystemRate).toBeGreaterThanOrEqual(platform.ecosystemRate);
    expect(ai.marketingHype).toBeGreaterThanOrEqual(platform.marketingHype);
    expect(eraRuleSummary(4)).toContain("volatile");
  });

  it("clamps out-of-range eras to the table bounds", () => {
    expect(eraModifier(0)).toEqual(eraModifier(1));
    expect(eraModifier(99)).toEqual(eraModifier(BALANCE.eras.length));
  });
});
