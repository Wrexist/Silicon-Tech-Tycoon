import { describe, it, expect } from "vitest";
import {
  newGame,
  autoAssignIdle,
  autoClaimResearch,
  canAutoAssign,
  canAutoResearch,
  applyWeeklyAutomation,
  setAutomation,
  advanceOneWeek,
  type GameState,
} from "./gameState.ts";
import { dollars } from "../engine/money.ts";
import type { Staff } from "../engine/types.ts";

/** Replace the roster with spreads of the founder (a valid Staff) so we control role/skill/assignment. */
function withStaff(base: GameState, overrides: Partial<Staff>[]): GameState {
  const proto = base.staff[0];
  return { ...base, staff: overrides.map((o, i) => ({ ...proto, id: `s${i}`, ...o })) };
}

describe("Epic E — delegation policies", () => {
  it("auto-assign sends idle staff to their discipline; busy staff untouched", () => {
    const g = withStaff(newGame(1), [
      { role: "engineer", assignment: "idle", skill: 6 },
      { role: "marketer", assignment: "marketing", skill: 6 },
    ]);
    const a = autoAssignIdle(g);
    expect(a.staff[0].assignment).toBe("rnd");
    expect(a.staff[1].assignment).toBe("marketing");
  });

  it("auto-assign is a no-op (same ref) when nobody is idle", () => {
    const g = withStaff(newGame(1), [{ role: "engineer", assignment: "rnd", skill: 6 }]);
    expect(autoAssignIdle(g)).toBe(g);
  });

  it("auto-research claims the cheapest affordable project and spends RP", () => {
    const g: GameState = { ...withStaff(newGame(2), [{ role: "engineer", skill: 6, assignment: "rnd" }]), era: 1, researchPoints: 9999 };
    const before = g.completedProjects.length;
    const a = autoClaimResearch(g);
    expect(a.completedProjects.length).toBe(before + 1);
    expect(a.researchPoints).toBeLessThan(g.researchPoints);
  });

  it("auto-research is a no-op with no RP", () => {
    const g: GameState = { ...newGame(2), researchPoints: 0 };
    expect(autoClaimResearch(g)).toBe(g);
  });

  it("gates auto-assign on a senior staffer and auto-research on a senior engineer", () => {
    expect(canAutoAssign(withStaff(newGame(3), [{ role: "engineer", skill: 3 }]))).toBe(false);
    expect(canAutoAssign(withStaff(newGame(3), [{ role: "engineer", skill: 7 }]))).toBe(true);
    expect(canAutoResearch(withStaff(newGame(3), [{ role: "designer", skill: 9 }]))).toBe(false); // not an engineer
    expect(canAutoResearch(withStaff(newGame(3), [{ role: "engineer", skill: 7 }]))).toBe(true);
  });

  it("applyWeeklyAutomation respects toggles + capability (off by default = same ref)", () => {
    const g = withStaff(newGame(4), [{ role: "engineer", assignment: "idle", skill: 6 }]);
    expect(applyWeeklyAutomation(g)).toBe(g); // toggles off
    expect(applyWeeklyAutomation(setAutomation(g, { autoAssign: true })).staff[0].assignment).toBe("rnd");
    // enabled but the only staffer is junior → capability gate blocks it
    const junior = setAutomation(withStaff(newGame(4), [{ role: "engineer", assignment: "idle", skill: 3 }]), { autoAssign: true });
    expect(applyWeeklyAutomation(junior).staff[0].assignment).toBe("idle");
  });

  it("a live tick auto-assigns idle staff when delegation is on", () => {
    let g = withStaff({ ...newGame(5), cash: dollars(1_000_000) }, [{ role: "engineer", assignment: "idle", skill: 6 }]);
    g = setAutomation(g, { autoAssign: true });
    expect(advanceOneWeek(g).staff[0].assignment).toBe("rnd");
  });
});
