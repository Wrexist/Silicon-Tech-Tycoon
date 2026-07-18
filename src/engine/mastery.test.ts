import { describe, it, expect } from "vitest";
import type { LaunchedProduct, CategoryId } from "./types.ts";
import {
  pointsForLaunch,
  levelForPoints,
  nextThreshold,
  categoryPoints,
  categoryLevelOf,
  categoryMastery,
  masteryBonusForLevel,
  signatureUnlocked,
  unlockedSignatures,
  MASTERY_MAX_LEVEL,
  MASTERY_THRESHOLDS,
  MASTERY_PER_LEVEL,
  MASTERY_POINTS,
  CATEGORY_SIGNATURES,
  ZERO_MASTERY_BONUS,
} from "./mastery.ts";
import { CATEGORY_LIST } from "./catalogs.ts";

// A minimal launch record — only the fields mastery reads (category + verdict).
function launch(category: CategoryId, verdict?: LaunchedProduct["verdict"]): LaunchedProduct {
  return { product: { category }, verdict } as unknown as LaunchedProduct;
}

describe("mastery — points per launch", () => {
  it("scores a launch by its verdict", () => {
    expect(pointsForLaunch("hit")).toBe(3);
    expect(pointsForLaunch("solid")).toBe(2);
    expect(pointsForLaunch("flop")).toBe(1);
    expect(pointsForLaunch("steady")).toBe(1);
    expect(pointsForLaunch(undefined)).toBe(1);
  });

  it("hit/solid bonuses are exactly the configured increments over base", () => {
    expect(pointsForLaunch("hit")).toBe(MASTERY_POINTS.base + MASTERY_POINTS.hit);
    expect(pointsForLaunch("solid")).toBe(MASTERY_POINTS.base + MASTERY_POINTS.solid);
  });
});

describe("mastery — level thresholds", () => {
  it("crosses a level exactly at each threshold", () => {
    expect(levelForPoints(0)).toBe(0);
    for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) {
      const t = MASTERY_THRESHOLDS[i];
      expect(levelForPoints(t - 1)).toBe(i); // one short → previous level
      expect(levelForPoints(t)).toBe(i + 1); // exactly at → this level
    }
  });

  it("caps at MAX level however many points accrue", () => {
    expect(levelForPoints(1_000_000)).toBe(MASTERY_MAX_LEVEL);
    expect(MASTERY_THRESHOLDS.length).toBe(MASTERY_MAX_LEVEL);
  });

  it("reports the next threshold, null when maxed", () => {
    expect(nextThreshold(0)).toBe(MASTERY_THRESHOLDS[0]);
    expect(nextThreshold(4)).toBe(MASTERY_THRESHOLDS[4]);
    expect(nextThreshold(MASTERY_MAX_LEVEL)).toBeNull();
  });
});

describe("mastery — category scoping", () => {
  it("counts only launches in the queried category", () => {
    const launched = [launch("phone", "hit"), launch("tablet", "solid"), launch("phone", "flop")];
    expect(categoryPoints(launched, "phone")).toBe(3 + 1); // hit + flop
    expect(categoryPoints(launched, "tablet")).toBe(2);
    expect(categoryPoints(launched, "laptop")).toBe(0);
  });

  it("derives per-category levels from the launch history", () => {
    // 5 phone hits = 15 pts → level 5; 1 tablet flop = 1 pt → level 1.
    const launched = [
      ...Array.from({ length: 5 }, () => launch("phone", "hit")),
      launch("tablet", "flop"),
    ];
    const table = categoryMastery(launched);
    expect(table.phone.points).toBe(15);
    expect(table.phone.level).toBe(5);
    expect(table.phone.launches).toBe(5);
    expect(table.tablet.level).toBe(1);
    expect(table.laptop.level).toBe(0);
    // Every category is present in the table.
    for (const c of CATEGORY_LIST) expect(table[c.id]).toBeDefined();
  });

  it("categoryLevelOf agrees with the full table", () => {
    const launched = [launch("wearable", "solid"), launch("wearable", "solid")]; // 4 pts → level 2
    expect(categoryLevelOf(launched, "wearable")).toBe(2);
    expect(categoryLevelOf(launched, "wearable")).toBe(categoryMastery(launched).wearable.level);
  });

  it("ignores malformed / uncategorised records without throwing", () => {
    const bad = [{ verdict: "hit" }, { product: {} }, null, undefined] as unknown as LaunchedProduct[];
    expect(() => categoryMastery(bad)).not.toThrow();
    expect(categoryPoints(bad, "phone")).toBe(0);
  });
});

describe("mastery — bonus caps + scoping", () => {
  it("level 0 is a byte-exact zero (do-nothing no-op)", () => {
    expect(masteryBonusForLevel(0)).toBe(ZERO_MASTERY_BONUS);
    expect(masteryBonusForLevel(0)).toEqual({ buildCostMult: 0, design: 0, hype: 0 });
  });

  it("scales linearly per level and never exceeds the L5 cap", () => {
    for (let l = 1; l <= MASTERY_MAX_LEVEL; l++) {
      const b = masteryBonusForLevel(l);
      expect(b.buildCostMult).toBeCloseTo(MASTERY_PER_LEVEL.buildCostMult * l, 10);
      expect(b.design).toBeCloseTo(MASTERY_PER_LEVEL.design * l, 10);
      expect(b.hype).toBeCloseTo(MASTERY_PER_LEVEL.hype * l, 10);
    }
    // Hard caps at level 5 — deliberately small so mastery can't outclass perks/legacy.
    const cap = masteryBonusForLevel(MASTERY_MAX_LEVEL);
    expect(cap.buildCostMult).toBeCloseTo(0.05, 10); // ≤ 5%
    expect(cap.design).toBeCloseTo(2, 10);           // ≤ 2 design
    expect(cap.hype).toBeCloseTo(0.05, 10);          // ≤ 5%
  });

  it("clamps out-of-range levels", () => {
    expect(masteryBonusForLevel(99)).toEqual(masteryBonusForLevel(MASTERY_MAX_LEVEL));
    expect(masteryBonusForLevel(-3)).toBe(ZERO_MASTERY_BONUS);
  });
});

describe("mastery — signatures", () => {
  it("unlocks a signature only at level 5", () => {
    const four = Array.from({ length: 4 }, () => launch("console", "hit")); // 12 pts → level 4
    expect(signatureUnlocked(four, "console")).toBe(false);
    const five = Array.from({ length: 5 }, () => launch("console", "hit")); // 15 pts → level 5
    expect(signatureUnlocked(five, "console")).toBe(true);
  });

  it("lists every mastered category's signature", () => {
    const launched = [
      ...Array.from({ length: 5 }, () => launch("phone", "hit")),
      ...Array.from({ length: 5 }, () => launch("laptop", "hit")),
    ];
    expect(unlockedSignatures(launched).sort()).toEqual(["laptop", "phone"]);
  });

  it("every category has a signature definition", () => {
    for (const c of CATEGORY_LIST) {
      expect(CATEGORY_SIGNATURES[c.id]).toBeDefined();
      expect(CATEGORY_SIGNATURES[c.id].edition.length).toBeGreaterThan(0);
    }
  });
});
