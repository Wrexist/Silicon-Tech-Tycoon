import { describe, it, expect } from "vitest";
import {
  clampAscension,
  ascensionBarFactor,
  ascensionHeadStartFactor,
  ascensionLegendBonus,
  ascensionName,
} from "./ascension.ts";
import { BALANCE } from "./balance.ts";

describe("ascension / heat ladder", () => {
  it("level 0 / undefined is the neutral identity (byte-identical to no ascension)", () => {
    expect(clampAscension(undefined)).toBe(0);
    expect(clampAscension(0)).toBe(0);
    expect(ascensionBarFactor(0)).toBe(1);
    expect(ascensionBarFactor(undefined)).toBe(1);
    expect(ascensionHeadStartFactor(0)).toBe(1);
    expect(ascensionLegendBonus(0)).toBe(0);
  });

  it("clamps to 0..maxLevel", () => {
    expect(clampAscension(-3)).toBe(0);
    expect(clampAscension(999)).toBe(BALANCE.ascension.maxLevel);
    expect(clampAscension(2.9)).toBe(2);
  });

  it("higher Heat raises the verdict bars and cuts the head-start", () => {
    expect(ascensionBarFactor(1)).toBeCloseTo(1.06, 5);
    expect(ascensionBarFactor(5)).toBeCloseTo(1.3, 5);
    expect(ascensionBarFactor(3)).toBeGreaterThan(ascensionBarFactor(2));
    // head-start shrinks and floors at 0, never negative
    expect(ascensionHeadStartFactor(1)).toBeCloseTo(0.8, 5);
    expect(ascensionHeadStartFactor(5)).toBeCloseTo(0, 5);
    expect(ascensionHeadStartFactor(10)).toBe(0);
    for (let l = 0; l <= 10; l++) expect(ascensionHeadStartFactor(l)).toBeGreaterThanOrEqual(0);
  });

  it("legend bonus scales with best level cleared", () => {
    expect(ascensionLegendBonus(1)).toBe(BALANCE.ascension.legendPerLevel);
    expect(ascensionLegendBonus(4)).toBe(4 * BALANCE.ascension.legendPerLevel);
    expect(ascensionLegendBonus(7)).toBeGreaterThan(ascensionLegendBonus(6));
  });

  it("names each rung, with a plain Heat N fallback past the table", () => {
    expect(ascensionName(0)).toBe("No Heat");
    expect(ascensionName(3)).toBe("Heat 3 · Scorching");
    expect(ascensionName(10)).toBe("Heat 10 · Singularity");
  });
});
