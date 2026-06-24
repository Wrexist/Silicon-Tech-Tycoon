import { describe, expect, it } from "vitest";
import {
  OBJECTIVES,
  OBJECTIVE_COUNT,
  objectiveById,
  currentObjective,
  satisfiedObjectiveIds,
  newlyCompletedObjectives,
} from "./objectives.ts";
import { newGame, type GameState } from "../state/gameState.ts";

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

  it("skips out-of-order satisfied objectives to the earliest unfinished", () => {
    // Two products shipped (first + second launch done) but still a solo founder: the next move is
    // the still-unfinished hire, not the already-satisfied second-launch.
    const s = game({ launched: [{ verdict: "solid" }, { verdict: "flop" }] as never });
    expect(currentObjective(s)?.objective.id).toBe("hire-first");
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

  it("counts an owned office upgrade", () => {
    expect(satisfiedObjectiveIds(game({ upgrades: { workstations: 1 } as never }))).toContain("first-upgrade");
    expect(satisfiedObjectiveIds(game({ upgrades: {} }))).not.toContain("first-upgrade");
  });
});
