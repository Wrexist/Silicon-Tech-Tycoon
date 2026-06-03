import { describe, it, expect } from "vitest";
import { format, dollars, type Money } from "./money.ts";
import { weeklyRp } from "./research.ts";
import {
  UPGRADE_LINES,
  nextUpgradeCost,
  rpMultiplier,
  designCeilingBonus,
  buildCostMult,
  buildWeekReduction,
} from "./upgrades.ts";

describe("money format safety (audit fix)", () => {
  it("never throws on non-finite money", () => {
    expect(format(Infinity as Money)).toBe("$0");
    expect(format(-Infinity as Money)).toBe("$0");
    expect(format(NaN as Money)).toBe("$0");
  });
});

describe("research RP era clamp (audit fix)", () => {
  it("returns a finite number even for an out-of-range era", () => {
    const staff = [{ id: "s0", role: "engineer", name: "F", skill: 3, salary: dollars(0), assignment: "rnd", xp: 0, specialty: "performance", trait: "veteran", mood: 70, appearance: { skin: 0, hair: 0, hairColor: 0, shirt: 0, accessory: "none" } }] as never;
    expect(Number.isFinite(weeklyRp(staff, 0))).toBe(true);
    expect(Number.isFinite(weeklyRp(staff, 99))).toBe(true);
  });
});

describe("office upgrades", () => {
  it("every line has costs that strictly increase per tier", () => {
    for (const line of UPGRADE_LINES) {
      let prev = 0;
      for (let t = 0; t < line.maxTier; t++) {
        const c = nextUpgradeCost(line.id, t)!;
        expect(c).toBeGreaterThan(prev);
        prev = c;
      }
      expect(nextUpgradeCost(line.id, line.maxTier)).toBeNull();
    }
  });
  it("effect helpers scale with tier", () => {
    expect(rpMultiplier({ computers: 0 })).toBe(1);
    expect(rpMultiplier({ computers: 4 })).toBeCloseTo(1.6, 5);
    expect(designCeilingBonus({ designSuite: 3 })).toBe(3);
    expect(buildCostMult({ assembly: 5 })).toBeCloseTo(0.75, 5);
    expect(buildWeekReduction({ assembly: 4 })).toBe(2);
  });
});
