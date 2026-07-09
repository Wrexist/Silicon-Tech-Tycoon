// Timed research: starting a tier/project pays RP up front and develops over cost-scaled weeks (one
// slot), completing in the tick with the SAME effect as the instant primitives. Determinism-safe: the
// pinned solo sim never starts research → activeResearch stays null → byte-identical.
import { describe, it, expect } from "vitest";
import {
  newGame, startResearchTier, startResearchProject, cancelResearch, researchWeeksFor,
  researchBusy, researchWeeksLeft, researchedTier, advanceOneWeek, type GameState,
} from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";

const T = BALANCE.research.timer;

function labbed(seed = 4): GameState {
  // A funded lab: plenty of RP so cost never blocks the start.
  return { ...newGame(seed), researchPoints: 500 } as GameState;
}

describe("researchWeeksFor", () => {
  it("scales with cost and clamps to the tuned band", () => {
    expect(researchWeeksFor(T.rpPerWeek)).toBe(1);
    expect(researchWeeksFor(1)).toBe(T.minWeeks);
    expect(researchWeeksFor(100000)).toBe(T.maxWeeks);
    expect(researchWeeksFor(T.rpPerWeek * 3)).toBe(Math.min(T.maxWeeks, 3));
  });
});

describe("starting research", () => {
  it("pays RP up front, occupies the slot, and does NOT complete immediately", () => {
    const g = labbed();
    const before = researchedTier(g, "chip");
    const s = startResearchTier(g, "chip");
    expect(s.activeResearch).not.toBeNull();
    expect(s.activeResearch!.kind).toBe("tier");
    expect(s.researchPoints).toBeLessThan(g.researchPoints); // paid up front
    expect(researchedTier(s, "chip")).toBe(before); // not applied yet
    expect(researchBusy(s)).toBe(true);
  });

  it("only one research at a time — a second start is a no-op", () => {
    const s = startResearchTier(labbed(), "chip");
    const s2 = startResearchTier(s, "display");
    expect(s2).toBe(s);
    expect(startResearchProject(s, "assemblyLine")).toBe(s);
  });

  it("completes after totalWeeks, applying the tier (same effect as the instant path)", () => {
    let s = startResearchTier(labbed(), "chip");
    const target = s.activeResearch!.tierLevel!;
    const weeks = s.activeResearch!.totalWeeks;
    expect(researchWeeksLeft(s)).toBe(weeks);
    for (let w = 0; w < weeks; w++) s = advanceOneWeek(s);
    expect(s.activeResearch ?? null).toBeNull();
    expect(researchedTier(s, "chip")).toBe(target);
  });

  it("a project completes and lands in completedProjects", () => {
    let s = startResearchProject(labbed(6), "assemblyLine");
    expect(s.activeResearch!.kind).toBe("project");
    const weeks = s.activeResearch!.totalWeeks;
    for (let w = 0; w < weeks; w++) s = advanceOneWeek(s);
    expect(s.completedProjects).toContain("assemblyLine");
    expect(s.activeResearch ?? null).toBeNull();
  });
});

describe("cancel", () => {
  it("refunds the RP and frees the slot", () => {
    const g = labbed();
    const s = startResearchTier(g, "chip");
    const c = cancelResearch(s);
    expect(c.activeResearch ?? null).toBeNull();
    expect(c.researchPoints).toBe(g.researchPoints); // fully refunded
    expect(researchBusy(c)).toBe(false);
  });
});

describe("determinism safety", () => {
  it("a solo run never starts research → activeResearch stays null and RP banks as before", () => {
    let s = { ...newGame(999) } as GameState;
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.activeResearch ?? null).toBeNull();
    expect(s.researchPoints).toBeGreaterThan(0); // RP still accrued into the bank
  });
});
