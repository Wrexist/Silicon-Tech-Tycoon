// Timed research: starting a tier/project pays RP up front and develops over cost-scaled weeks (one
// slot), completing in the tick with the SAME effect as the instant primitives. Determinism-safe: the
// pinned solo sim never starts research → activeResearch stays null → byte-identical.
import { describe, it, expect } from "vitest";
import {
  newGame, startResearchTier, startResearchProject, cancelResearch, cancelQueuedResearch, researchWeeksFor,
  researchBusy, researchWeeksLeft, researchQueueList, researchQueueFull,
  tierResearchStatus, projectResearchStatus, researchedTier, advanceOneWeek, type GameState,
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

  it("only one research develops at a time — a second start queues instead of a no-op", () => {
    const s = startResearchTier(labbed(), "chip");
    const s2 = startResearchTier(s, "display");
    expect(s2).not.toBe(s); // accepted (queued), not a no-op
    expect(s2.activeResearch!.ref).toBe("chip"); // chip is still the only one developing
    expect(researchQueueList(s2).map((q) => q.ref)).toEqual(["display"]);
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

describe("queue", () => {
  it("a second buy lines up behind the active one (one develops at a time)", () => {
    let s = startResearchTier(labbed(), "chip");
    s = startResearchProject(s, "assemblyLine");
    expect(s.activeResearch!.ref).toBe("chip"); // still the first one
    expect(researchQueueList(s).map((q) => q.ref)).toEqual(["assemblyLine"]);
    expect(projectResearchStatus(s, "assemblyLine")).toBe("queued");
    expect(tierResearchStatus(s, "chip")).toBe("active");
  });

  it("the same line/project can't be queued twice", () => {
    let s = startResearchTier(labbed(), "chip");   // chip active
    s = startResearchProject(s, "assemblyLine");    // queued
    expect(startResearchTier(s, "chip")).toBe(s);          // chip already active
    expect(startResearchProject(s, "assemblyLine")).toBe(s); // already queued
  });

  it("the queue caps at maxQueue", () => {
    let s = startResearchTier(labbed(), "chip"); // active
    const lines = ["display", "battery", "materials", "software", "camera"] as const;
    for (const k of lines) s = startResearchTier(s, k);
    expect(researchQueueList(s).length).toBe(BALANCE.research.timer.maxQueue);
    expect(researchQueueFull(s)).toBe(true);
  });

  it("completing the active one auto-starts the next in line", () => {
    let s = startResearchTier(labbed(), "chip");
    s = startResearchProject(s, "assemblyLine");
    const weeks = s.activeResearch!.totalWeeks;
    for (let w = 0; w < weeks; w++) s = advanceOneWeek(s);
    expect(researchedTier(s, "chip")).toBeGreaterThan(researchedTier(labbed(), "chip")); // first applied
    expect(s.activeResearch!.ref).toBe("assemblyLine"); // next now developing
    expect(researchQueueList(s).length).toBe(0);
  });
});

describe("cancel", () => {
  it("cancelling the active one refunds it and pulls the next queued up", () => {
    const g = labbed();
    let s = startResearchTier(g, "chip");
    const chipCost = g.researchPoints - s.researchPoints;
    s = startResearchProject(s, "assemblyLine");
    const beforeCancel = s.researchPoints;
    const c = cancelResearch(s);
    expect(c.activeResearch!.ref).toBe("assemblyLine"); // promoted
    expect(c.researchPoints).toBe(beforeCancel + chipCost); // chip refunded; assemblyLine stays paid
    expect(researchQueueList(c).length).toBe(0);
  });

  it("cancelling with an empty queue frees the slot", () => {
    const g = labbed();
    const s = startResearchTier(g, "chip");
    const c = cancelResearch(s);
    expect(c.activeResearch ?? null).toBeNull();
    expect(c.researchPoints).toBe(g.researchPoints); // fully refunded
    expect(researchBusy(c)).toBe(false);
  });

  it("a queued item can be removed and refunded without touching the active one", () => {
    let s = startResearchTier(labbed(), "chip");
    const activeRp = s.researchPoints;
    s = startResearchProject(s, "assemblyLine");
    const c = cancelQueuedResearch(s, "assemblyLine");
    expect(c.activeResearch!.ref).toBe("chip"); // untouched
    expect(researchQueueList(c).length).toBe(0);
    expect(c.researchPoints).toBe(activeRp); // the queued item's RP came back
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
