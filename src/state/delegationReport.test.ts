// Delegation specialists report in (item 5.6): when a Lead reassigns idle staff or claims research,
// they post a named line to the feed. Only when delegation is ON + the Lead is employed — so a save
// with delegation OFF (the pinned sim) is byte-identical.
import { describe, expect, it } from "vitest";
import { applyWeeklyAutomation, newGame, type GameState } from "./gameState.ts";
import type { Staff } from "../engine/types.ts";

const lead = (role: Staff["role"], name: string): Staff => ({
  id: `lead-${role}`, role, name, skill: 8,
  skills: { engineering: 80, design: 40, marketing: 40 },
  salary: 120000 as Staff["salary"], assignment: "idle", xp: 0, hiredWeek: 0,
  specialty: "performance", trait: "hustler", mood: 70, appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
});

describe("delegation reports (item 5.6)", () => {
  it("the People Lead reports reassigning idle staff", () => {
    const idle: Staff = { ...lead("engineer", "Sam Rivera"), id: "e1", assignment: "idle" };
    const peopleLead: Staff = { ...lead("hr", "Jordan Blake"), assignment: "office" };
    const g: GameState = {
      ...newGame(3),
      completedProjects: ["peopleOps"],
      staff: [...newGame(3).staff, peopleLead, idle],
      automation: { ...newGame(3).automation, autoAssign: true },
    };
    const out = applyWeeklyAutomation(g);
    expect(out.staff.find((s) => s.id === "e1")!.assignment).not.toBe("idle"); // reassigned
    expect(out.feed.some((f) => f.text.includes("Jordan Blake") && f.text.includes("back on task"))).toBe(true);
  });

  it("the Lead Researcher recommends the next breakthrough after a claim", () => {
    const researcher: Staff = { ...lead("researcher", "Dr. Mina Okafor"), assignment: "rnd" };
    const g: GameState = {
      ...newGame(3),
      researchPoints: 10_000,
      completedProjects: ["researchDivision"],
      staff: [...newGame(3).staff, researcher],
      automation: { ...newGame(3).automation, autoResearch: true },
    };
    const out = applyWeeklyAutomation(g);
    expect(out.completedProjects.length).toBeGreaterThan(g.completedProjects.length); // a project was claimed
    expect(out.feed.some((f) => f.text.includes("Dr. Mina Okafor") && f.text.includes("recommends"))).toBe(true);
  });

  it("delegation OFF is a pure no-op — no reports, same state object", () => {
    const g = newGame(3); // automation defaults off
    expect(applyWeeklyAutomation(g)).toBe(g);
  });
});
