import { describe, it, expect } from "vitest";
import {
  FAMILY_OF,
  LINE_RECIPES,
  lineFor,
  stageForLine,
  stageIndexForLine,
  type LineFamily,
} from "./assemblyLine.ts";
import type { CategoryId } from "./types.ts";

const CATEGORIES: CategoryId[] = [
  "phone", "tablet", "laptop", "desktop", "monitor", "console", "wearable", "experimental",
];

describe("assemblyLine recipes", () => {
  it("gives phone and tablet the same line, and laptop a different one", () => {
    expect(FAMILY_OF.phone).toBe(FAMILY_OF.tablet);
    expect(lineFor("phone")).toBe(lineFor("tablet"));
    expect(FAMILY_OF.laptop).not.toBe(FAMILY_OF.phone);
    // The stages themselves differ (not just the family label).
    const phoneKeys = lineFor("phone").map((s) => s.key).join(",");
    const laptopKeys = lineFor("laptop").map((s) => s.key).join(",");
    expect(laptopKeys).not.toBe(phoneKeys);
  });

  it("maps every category to a defined recipe", () => {
    for (const cat of CATEGORIES) {
      const stages = lineFor(cat);
      expect(stages.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps every recipe well-formed: starts at 0, ascending, machineStage 0..4", () => {
    for (const fam of Object.keys(LINE_RECIPES) as LineFamily[]) {
      const stages = LINE_RECIPES[fam];
      expect(stages[0].from).toBe(0);
      for (let i = 1; i < stages.length; i++) {
        expect(stages[i].from).toBeGreaterThan(stages[i - 1].from);
      }
      for (const s of stages) {
        expect(s.machineStage).toBeGreaterThanOrEqual(0);
        expect(s.machineStage).toBeLessThanOrEqual(4);
        expect(s.from).toBeGreaterThanOrEqual(0);
        expect(s.from).toBeLessThanOrEqual(1);
      }
      // First step feeds the intake (0), last packs (4).
      expect(stages[0].machineStage).toBe(0);
      expect(stages[stages.length - 1].machineStage).toBe(4);
    }
  });

  it("selects the active stage monotonically as the build progresses", () => {
    for (const cat of CATEGORIES) {
      let lastIdx = -1;
      for (let frac = 0; frac <= 1.0001; frac += 0.05) {
        const idx = stageIndexForLine(cat, Math.min(1, frac));
        expect(idx).toBeGreaterThanOrEqual(lastIdx);
        lastIdx = idx;
      }
      // At the very end the last stage is active.
      expect(stageForLine(cat, 1).key).toBe(lineFor(cat)[lineFor(cat).length - 1].key);
      // At the very start the first stage is active.
      expect(stageForLine(cat, 0).key).toBe(lineFor(cat)[0].key);
    }
  });

  it("clamps out-of-range fractions to the first/last stage", () => {
    expect(stageForLine("phone", -5).key).toBe(lineFor("phone")[0].key);
    expect(stageForLine("phone", 99).key).toBe(lineFor("phone")[lineFor("phone").length - 1].key);
  });
});
