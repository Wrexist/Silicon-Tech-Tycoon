import { describe, it, expect } from "vitest";
import {
  newGame,
  autoAssignIdle,
  autoClaimResearch,
  canAutoAssign,
  canAutoResearch,
  applyWeeklyAutomation,
  setAutomation,
  hireSpecialist,
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

  it("gates auto-assign on People Operations + a People Lead, auto-research on Research Division + a Lead Researcher", () => {
    const base = newGame(3);
    // A specialist hired but no research division → still locked.
    expect(canAutoAssign(withStaff(base, [{ role: "hr", skill: 6 }]))).toBe(false);
    // Division researched but no People Lead on staff → still locked.
    const div: GameState = { ...withStaff(base, [{ role: "engineer", skill: 9 }]), completedProjects: ["peopleOps"] };
    expect(canAutoAssign(div)).toBe(false);
    // Both prerequisites → capable.
    const ready: GameState = { ...withStaff(base, [{ role: "hr", skill: 6 }]), completedProjects: ["peopleOps"] };
    expect(canAutoAssign(ready)).toBe(true);

    expect(canAutoResearch(withStaff(base, [{ role: "researcher", skill: 6 }]))).toBe(false);
    const rdDiv: GameState = { ...withStaff(base, [{ role: "engineer", skill: 9 }]), completedProjects: ["researchDivision"] };
    expect(canAutoResearch(rdDiv)).toBe(false);
    const rdReady: GameState = { ...withStaff(base, [{ role: "researcher", skill: 6 }]), completedProjects: ["researchDivision"] };
    expect(canAutoResearch(rdReady)).toBe(true);
  });

  it("hireSpecialist needs the division first, then seats the specialist and unlocks the toggle", () => {
    const base: GameState = { ...newGame(9), cash: dollars(100_000), desktops: 6 };
    // Without the research division, recruiting the specialist is a no-op (same ref).
    expect(hireSpecialist(base, "autoAssign")).toBe(base);
    const withDiv: GameState = { ...base, completedProjects: ["peopleOps"] };
    const after = hireSpecialist(withDiv, "autoAssign");
    expect(after.staff.some((s) => s.role === "hr")).toBe(true);
    expect(after.cash).toBeLessThan(withDiv.cash); // paid the signing fee
    expect(canAutoAssign(after)).toBe(true);       // division + People Lead → capable
  });

  it("grandfathers a pre-gating save that already had an automation on (free of the new prerequisites)", () => {
    const g = withStaff(newGame(8), [{ role: "engineer", skill: 9 }]); // no division, no specialist
    expect(canAutoAssign(g)).toBe(false);
    expect(canAutoResearch(g)).toBe(false);
    expect(canAutoAssign(setAutomation(g, { autoAssignFree: true }))).toBe(true);
    expect(canAutoResearch(setAutomation(g, { autoResearchFree: true }))).toBe(true);
  });

  it("applyWeeklyAutomation respects toggles + capability (off by default = same ref)", () => {
    const capable: GameState = {
      ...withStaff(newGame(4), [{ role: "hr", assignment: "marketing", skill: 6 }, { role: "engineer", assignment: "idle", skill: 6 }]),
      completedProjects: ["peopleOps"],
    };
    expect(applyWeeklyAutomation(capable)).toBe(capable); // toggles off
    const eng = (s: GameState) => s.staff.find((m) => m.role === "engineer")!;
    expect(eng(applyWeeklyAutomation(setAutomation(capable, { autoAssign: true }))).assignment).toBe("rnd");
    // enabled but no division/specialist → capability gate blocks it
    const notCapable = setAutomation(withStaff(newGame(4), [{ role: "engineer", assignment: "idle", skill: 6 }]), { autoAssign: true });
    expect(applyWeeklyAutomation(notCapable).staff[0].assignment).toBe("idle");
  });

  it("a live tick auto-assigns idle staff when delegation is on and capable", () => {
    let g: GameState = {
      ...withStaff({ ...newGame(5), cash: dollars(1_000_000) }, [{ role: "hr", assignment: "marketing", skill: 6 }, { role: "engineer", assignment: "idle", skill: 6 }]),
      completedProjects: ["peopleOps"],
    };
    g = setAutomation(g, { autoAssign: true });
    expect(advanceOneWeek(g).staff.find((m) => m.role === "engineer")!.assignment).toBe("rnd");
  });
});

describe("People Operations: a People Lead keeps the team happy", () => {
  const proto = (seed: number) => newGame(seed).staff[0];

  it("lifts a teammate's weekly mood vs an otherwise-identical HR-less roster", () => {
    const p = proto(31);
    const withHr: GameState = {
      ...newGame(31), cash: dollars(5_000_000), onboarded: true,
      staff: [
        { ...p, id: "e1", role: "engineer", mood: 40, assignment: "rnd" },
        { ...p, id: "h1", role: "hr", skill: 8, mood: 70, assignment: "marketing" },
      ],
    };
    const noHr: GameState = { ...withHr, staff: [withHr.staff[0]] };
    // The engineer is staff[0] in both, so its mood-noise rng draw is identical; the only difference
    // is the People Lead's target lift + weekly nudge.
    const engWith = advanceOneWeek(withHr).staff.find((m) => m.id === "e1")!.mood;
    const engWithout = advanceOneWeek(noHr).staff.find((m) => m.id === "e1")!.mood;
    expect(engWith).toBeGreaterThan(engWithout);
  });

  it("resolves burnout: a People Lead on staff means sustained low mood never forces a quit, and they recover", () => {
    const p = proto(32);
    let s: GameState = {
      ...newGame(32), cash: dollars(5_000_000), onboarded: true,
      staff: [
        // A burned-out, underpaid engineer already deep in the danger zone…
        { ...p, id: "e1", role: "engineer", mood: 5, moodLowWeeks: 10, salary: dollars(1), skill: 5, assignment: "rnd" },
        // …with a strong People Lead employed.
        { ...p, id: "h1", role: "hr", skill: 9, mood: 80, assignment: "marketing" },
      ],
    };
    for (let i = 0; i < 30; i++) s = advanceOneWeek(s);
    expect(s.staff.some((m) => m.id === "e1")).toBe(true);                 // never quit
    expect(s.staff.find((m) => m.id === "e1")!.mood).toBeGreaterThan(22);  // climbed out of the danger zone
  });
});
