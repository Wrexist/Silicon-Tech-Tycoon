import { describe, expect, it } from "vitest";
import {
  OBJECTIVES,
  OBJECTIVE_COUNT,
  objectiveById,
  currentObjective,
  upcomingObjectives,
  satisfiedObjectiveIds,
  newlyCompletedObjectives,
} from "./objectives.ts";
import { newGame, type GameState } from "../state/gameState.ts";
import { MEGAPROJECTS } from "./endgame.ts";

/** A fresh garage with the given overrides applied. */
function game(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(1), ...overrides };
}

describe("objectives catalog", () => {
  it("has unique ids and a matching count", () => {
    const ids = OBJECTIVES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(OBJECTIVE_COUNT).toBe(OBJECTIVES.length);
  });

  it("resolves objectives by id", () => {
    expect(objectiveById("first-launch")?.label).toMatch(/first product/i);
    expect(objectiveById("nope")).toBeUndefined();
  });

  it("every objective deep-links to a real tab and has copy", () => {
    const tabs = new Set(["hq", "design", "research", "market", "company"]);
    for (const o of OBJECTIVES) {
      expect(tabs.has(o.tab)).toBe(true);
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.detail.length).toBeGreaterThan(0);
      expect(o.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("currentObjective", () => {
  it("starts at 'launch your first product' for a fresh game", () => {
    const p = currentObjective(game());
    expect(p?.objective.id).toBe("first-launch");
    expect(p?.step).toBe(1);
    expect(p?.total).toBe(OBJECTIVE_COUNT);
  });

  it("advances to hiring once a product has shipped", () => {
    const s = game({ launched: [{ verdict: "solid" }] as never });
    expect(currentObjective(s)?.objective.id).toBe("hire-first");
  });

  it("skips a latched-complete objective even if its predicate reads false", () => {
    // Shipped (first-launch done) but solo founder (hire-first NOT done) — yet hire-first is latched.
    const s = game({ launched: [{ verdict: "solid" }] as never });
    const p = currentObjective(s, ["first-launch", "hire-first"]);
    expect(p?.objective.id).toBe("second-launch");
  });

  it("returns null when the whole ladder is complete", () => {
    const allIds = OBJECTIVES.map((o) => o.id);
    expect(currentObjective(game(), allIds)).toBeNull();
  });

  it("a fresh company re-walks the ladder (completion resets per run)", () => {
    const fresh = newGame(1);
    expect(fresh.completedObjectives).toEqual([]);
    expect(currentObjective(fresh)?.objective.id).toBe("first-launch");
  });

  it("skips out-of-order satisfied objectives to the earliest unfinished", () => {
    // Two products shipped (first + second launch done) but still a solo founder: the next move is
    // the still-unfinished hire, not the already-satisfied second-launch.
    const s = game({ launched: [{ verdict: "solid" }, { verdict: "flop" }] as never });
    expect(currentObjective(s)?.objective.id).toBe("hire-first");
  });
});

describe("upcomingObjectives", () => {
  it("starts with the current next-move and previews the ladder in order", () => {
    const up = upcomingObjectives(game(), 3);
    expect(up.map((o) => o.objective.id)).toEqual(["first-launch", "hire-first", "second-launch"]);
    // The first entry matches currentObjective exactly (same skip rule).
    expect(up[0].objective.id).toBe(currentObjective(game())!.objective.id);
    expect(up[0].step).toBe(1);
    expect(up[2].step).toBe(3);
    expect(up[0].total).toBe(OBJECTIVE_COUNT);
  });

  it("respects n and never exceeds the ladder length", () => {
    expect(upcomingObjectives(game(), 1)).toHaveLength(1);
    expect(upcomingObjectives(game(), 0)).toHaveLength(0);
    expect(upcomingObjectives(game(), 999).length).toBe(OBJECTIVE_COUNT);
  });

  it("skips latched-complete and live-satisfied rungs, keeping ladder order", () => {
    // Shipped once (first-launch live-done); hire-first latched. Preview starts at second-launch.
    const s = game({ launched: [{ verdict: "solid" }] as never });
    const up = upcomingObjectives(s, 2, ["first-launch", "hire-first"]);
    expect(up.map((o) => o.objective.id)).toEqual(["second-launch", "first-research"]);
    // Steps stay the 1-based ladder position, not a re-indexed count.
    expect(up[0].step).toBe(OBJECTIVES.findIndex((o) => o.id === "second-launch") + 1);
  });

  it("returns [] when the whole ladder is complete", () => {
    expect(upcomingObjectives(game(), 3, OBJECTIVES.map((o) => o.id))).toEqual([]);
  });
});

describe("satisfied / newly-completed", () => {
  it("reports all satisfied ids from live state", () => {
    const s = game({ launched: [{ verdict: "hit" }, { verdict: "solid" }] as never, staff: [{}, {}] as never });
    const ids = satisfiedObjectiveIds(s);
    expect(ids).toEqual(expect.arrayContaining(["first-launch", "second-launch", "first-hit", "hire-first"]));
    expect(ids).not.toContain("go-public");
  });

  it("diffs against the previously-completed set", () => {
    const s = game({ launched: [{ verdict: "solid" }] as never });
    expect(newlyCompletedObjectives([], s)).toContain("first-launch");
    expect(newlyCompletedObjectives(["first-launch"], s)).not.toContain("first-launch");
  });

  it("treats platform/IPO/pinnacle flags as completion", () => {
    expect(satisfiedObjectiveIds(game({ platformUnlocked: true }))).toContain("found-platform");
    expect(satisfiedObjectiveIds(game({ listed: true }))).toContain("go-public");
    expect(satisfiedObjectiveIds(game({ wentPublic: true }))).toContain("reach-pinnacle");
  });

  it("the ladder extends past the IPO into the Legacy Era (goal spine never dead-ends there)", () => {
    // With everything up to the pinnacle latched, the next move is the first megaproject — the ladder
    // no longer dead-ends into undirected free play right after the IPO.
    const preLegacy = OBJECTIVES.map((o) => o.id).slice(0, OBJECTIVES.findIndex((o) => o.id === "reach-pinnacle") + 1);
    const justIPOd = game({ wentPublic: true });
    const next = currentObjective(justIPOd, preLegacy);
    expect(next?.objective.id).toBe("fund-megaproject");
    // Legacy-Era rungs latch on the real endgame state.
    expect(satisfiedObjectiveIds(game({ megaprojectsFunded: ["quantumFab"] }))).toContain("fund-megaproject");
    expect(satisfiedObjectiveIds(game({ legacyPerks: ["lt-hype1"] }))).toContain("spend-legacy-point");
    expect(satisfiedObjectiveIds(game({ bestIndustryRank: 1 }))).toContain("reach-number-one");
    // The capstone rung: funding the entire authored slate (boundary on MEGAPROJECTS.length).
    expect(satisfiedObjectiveIds(game({ megaprojectsFunded: MEGAPROJECTS.map((m) => m.id) }))).toContain("fund-all-megaprojects");
    expect(satisfiedObjectiveIds(game({ megaprojectsFunded: MEGAPROJECTS.slice(0, 1).map((m) => m.id) }))).not.toContain("fund-all-megaprojects");
  });

  it("explicit era rungs latch as the company advances", () => {
    expect(satisfiedObjectiveIds(game({ era: 3 }))).toContain("reach-era3");
    expect(satisfiedObjectiveIds(game({ era: 4 }))).toContain("reach-era4");
    expect(satisfiedObjectiveIds(game({ era: 2 }))).not.toContain("reach-era3");
  });

  it("counts an owned office upgrade", () => {
    expect(satisfiedObjectiveIds(game({ upgrades: { workstations: 1 } as never }))).toContain("first-upgrade");
    expect(satisfiedObjectiveIds(game({ upgrades: {} }))).not.toContain("first-upgrade");
  });
});
