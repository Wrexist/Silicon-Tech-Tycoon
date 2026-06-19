// State-layer scenario wiring: newScenarioGame applies authored start overrides, scenarioResultFor
// evaluates the active scenario, and the profile-level best-stars store is monotonic + persistent.
// node env (no DOM) → stub localStorage on globalThis, mirroring persistence.test.ts.
import { describe, it, expect, beforeEach } from "vitest";
import { newGame, newScenarioGame, scenarioResultFor, withScenarioRunStars } from "./gameState.ts";
import { SCENARIOS, scenarioById } from "../engine/scenarios.ts";
import { dollars, toDollars } from "../engine/money.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

beforeEach(() => {
  // @ts-expect-error stub for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("newScenarioGame", () => {
  it("tags the run and applies the scenario's start overrides", () => {
    const head = scenarioById("head-start")!;
    const g = newScenarioGame("head-start", 123);
    expect(g.activeScenario).toBe("head-start");
    expect(g.era).toBe(head.setup.era);
    expect(g.reputation).toBe(head.setup.reputation);
    expect(g.fans).toBe(head.setup.fans);
    expect(toDollars(g.cash)).toBe(toDollars(head.setup.cash!));
    // cashHistory seeds from the overridden start cash, not the default
    expect(g.cashHistory[0].cash).toBe(toDollars(head.setup.cash!));
    // scenarios skip the freeform onboarding + coach
    expect(g.onboarded).toBe(true);
    expect(g.tutorialDone).toBe(true);
  });

  it("an empty-setup scenario keeps the normal starting values", () => {
    const base = newGame(42);
    const g = newScenarioGame("first-light", 42);
    expect(g.activeScenario).toBe("first-light");
    expect(toDollars(g.cash)).toBe(toDollars(base.cash));
    expect(g.era).toBe(base.era);
  });

  it("an unknown scenario id falls back to a freeform game", () => {
    const g = newScenarioGame("does-not-exist", 7);
    expect(g.activeScenario).toBe(null);
  });
});

describe("withScenarioRunStars (run-scoped, replay-safe)", () => {
  it("is a no-op for a freeform run", () => {
    expect(withScenarioRunStars(newGame(1)).scenarioRunStars).toBe(0);
  });

  it("rises monotonically while stars are earnable", () => {
    // first-light 1★ = $250K revenue; inject it and advance the run-star count.
    const g = { ...newScenarioGame("first-light", 1), cumulativeRevenue: dollars(250_000) };
    expect(g.scenarioRunStars).toBe(0);
    const after = withScenarioRunStars(g);
    expect(after.scenarioRunStars).toBeGreaterThanOrEqual(1);
    // never decreases even if facts would imply fewer
    const lowered = withScenarioRunStars({ ...after, cumulativeRevenue: dollars(0) });
    expect(lowered.scenarioRunStars).toBe(after.scenarioRunStars);
  });

  it("freezes once a deadline scenario's deadline passes (no late credit)", () => {
    // underdog has a wk-78 deadline; past it, run stars can't advance.
    const g = { ...newScenarioGame("underdog", 1), week: 200, cumulativeRevenue: dollars(5_000_000) };
    expect(withScenarioRunStars(g).scenarioRunStars).toBe(0);
  });
});

describe("scenarioResultFor", () => {
  it("is null for a freeform game", () => {
    expect(scenarioResultFor(newGame(1))).toBe(null);
  });

  it("evaluates the active scenario (not won at the start)", () => {
    const g = newScenarioGame("first-light", 1);
    const res = scenarioResultFor(g)!;
    expect(res).not.toBe(null);
    expect(res.won).toBe(false);
    expect(res.stars).toBe(0);
  });

  it("reports a win once an objective is met", () => {
    // first-light 1★ = $250K lifetime revenue. Inject it directly to test the wiring.
    const g = { ...newScenarioGame("first-light", 1), cumulativeRevenue: dollars(250_000) };
    const res = scenarioResultFor(g)!;
    expect(res.stars).toBeGreaterThanOrEqual(1);
    expect(res.won).toBe(true);
  });
});

describe("scenario progress store", () => {
  it("records only the best stars (monotonic) and persists across reads", async () => {
    const { recordStars, bestStars, getScenarioStars } = await import("./scenarioProgress.ts");
    expect(bestStars("first-light")).toBe(0);

    expect(recordStars("first-light", 2)).toEqual({ improved: true, best: 2 });
    expect(bestStars("first-light")).toBe(2);

    // lower or equal never downgrades
    expect(recordStars("first-light", 1)).toEqual({ improved: false, best: 2 });
    expect(recordStars("first-light", 2)).toEqual({ improved: false, best: 2 });
    expect(bestStars("first-light")).toBe(2);

    // a better result improves it
    expect(recordStars("first-light", 3)).toEqual({ improved: true, best: 3 });
    expect(getScenarioStars()["first-light"]).toBe(3);
  });

  it("clamps out-of-range stars and tolerates a corrupt store", async () => {
    const { recordStars, bestStars, getScenarioStars } = await import("./scenarioProgress.ts");
    localStorage.setItem("silicon.scenarioStars.v1", "{not json");
    expect(getScenarioStars()).toEqual({});
    recordStars("empire", 99);
    expect(bestStars("empire")).toBe(3); // clamped to max
  });
});

describe("catalog ↔ state alignment", () => {
  it("every catalog scenario can start a tagged run", () => {
    for (const s of SCENARIOS) {
      expect(newScenarioGame(s.id, 1).activeScenario).toBe(s.id);
    }
  });
});
