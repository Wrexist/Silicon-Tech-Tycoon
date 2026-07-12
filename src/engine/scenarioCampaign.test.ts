// Scenario campaign chain (item 5.1): harder scenarios unlock only once enough total stars are banked.
import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioUnlocked, scenarioUnlockStars } from "./scenarios.ts";

describe("scenario campaign chain (item 5.1)", () => {
  it("intro scenarios are always open; harder tiers need more total stars", () => {
    const intro = SCENARIOS.filter((s) => s.difficulty === "intro");
    expect(intro.length).toBeGreaterThan(0);
    for (const s of intro) {
      expect(scenarioUnlockStars(s)).toBe(0);
      expect(scenarioUnlocked(s, 0)).toBe(true);
    }
    // Difficulty tiers are monotonically gated: intro ≤ standard ≤ hard ≤ expert.
    const byDiff = (d: string) => Math.min(...SCENARIOS.filter((s) => s.difficulty === d).map(scenarioUnlockStars));
    expect(byDiff("standard")).toBeGreaterThan(byDiff("intro"));
    expect(byDiff("hard")).toBeGreaterThan(byDiff("standard"));
    expect(byDiff("expert")).toBeGreaterThan(byDiff("hard"));
  });

  it("a scenario unlocks exactly at its star threshold", () => {
    for (const s of SCENARIOS) {
      const need = scenarioUnlockStars(s);
      if (need > 0) {
        expect(scenarioUnlocked(s, need - 1)).toBe(false);
        expect(scenarioUnlocked(s, need)).toBe(true);
      }
    }
  });

  it("the whole chain is completable — max stars comfortably exceeds the hardest gate", () => {
    const maxStars = SCENARIOS.length * 3;
    const hardestGate = Math.max(...SCENARIOS.map(scenarioUnlockStars));
    expect(maxStars).toBeGreaterThan(hardestGate);
    // And the gate is reachable from EARLIER scenarios alone (you never need a locked one to unlock it):
    // stars available from scenarios cheaper to unlock must meet each scenario's gate.
    for (const s of SCENARIOS) {
      const earlierStars = SCENARIOS.filter((o) => scenarioUnlockStars(o) < scenarioUnlockStars(s)).length * 3;
      expect(earlierStars).toBeGreaterThanOrEqual(scenarioUnlockStars(s));
    }
  });
});
