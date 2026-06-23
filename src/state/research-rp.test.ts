// RP income breakdown (Research "income" card). The selector must always reconcile with the totals
// the rest of the sim uses, so the breakdown can never lie about where Research Points come from.
import { describe, it, expect } from "vitest";
import { newGame, weeklyRpSources, weeklyRpGen, assignStaff } from "./gameState.ts";
import { rpSources, weeklyRp } from "../engine/research.ts";

describe("rpSources (engine) reconciles with weeklyRp", () => {
  it("the itemized sources sum to the total, across eras", () => {
    const g = newGame(11);
    for (const era of [1, 2, 3, 4]) {
      const sum = rpSources(g.staff, era).reduce((a, s) => a + s.rp, 0);
      expect(sum).toBeCloseTo(weeklyRp(g.staff, era), 9);
    }
  });
  it("always includes a founder trickle line", () => {
    expect(rpSources(newGame(1).staff, 1).some((s) => s.id === "founder")).toBe(true);
  });
});

describe("weeklyRpSources (state) reconciles with weeklyRpGen", () => {
  it("the displayed sources sum to the headline +/wk (global multipliers folded in)", () => {
    const g = newGame(7); // founder defaults to the R&D assignment
    const sum = weeklyRpSources(g).reduce((a, s) => a + s.rp, 0);
    expect(sum).toBeCloseTo(weeklyRpGen(g), 6);
    expect(weeklyRpSources(g)[0].rp).toBeGreaterThanOrEqual(weeklyRpSources(g).at(-1)!.rp); // sorted desc
  });
  it("only R&D-assigned staff contribute beyond the founder trickle", () => {
    const g = newGame(7);
    const off = assignStaff(g, "s0", "design"); // pull the founder off R&D
    const sources = weeklyRpSources(off);
    // Just the founder trickle remains (no staffer contribution lines).
    expect(sources.filter((s) => s.id !== "founder")).toHaveLength(0);
    expect(weeklyRpSources(off).reduce((a, s) => a + s.rp, 0)).toBeCloseTo(weeklyRpGen(off), 6);
  });
});
