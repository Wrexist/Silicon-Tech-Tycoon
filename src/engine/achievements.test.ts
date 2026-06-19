import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
  achievementById,
  deriveFacts,
  evaluateAchievements,
  newlyUnlocked,
  type AchievementFacts,
} from "./achievements.ts";
import { dollars } from "./money.ts";
import type { LaunchedProduct, Product } from "./types.ts";
import { evaluateAndUnlock, newGame, type GameState } from "../state/gameState.ts";

/** A facts object with nothing earned — every predicate should be false at this baseline. */
function emptyFacts(): AchievementFacts {
  return {
    productsShipped: 0,
    hits: 0,
    flops: 0,
    hitStreak: 0,
    soldOut: false,
    comebackFromFlop: false,
    cumulativeRevenue: 0,
    netWorth: 0,
    reputation: 0,
    fans: 0,
    era: 1,
    era2reached: false,
    era3reached: false,
    atFinalEra: false,
    listed: false,
    wentPublic: false,
    rivalsInvested: 0,
    staffCount: 0,
    completedProjects: 0,
    biggestRun: 0,
    categoriesShipped: 0,
    wonScenario: false,
    completedChallenge: false,
    releasedOsVersion: false,
  };
}

function product(name = "Aurora One"): Product {
  return {
    id: name,
    name,
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(160),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

function launched(verdict: "hit" | "flop" | "steady", opts: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: product(),
    stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(40),
    launchScore: 60,
    launchedWeek: 1,
    totalUnits: 1000,
    plannedUnits: 2000,
    weeklyUnits: [1000],
    unitsSold: 1000,
    weeksElapsed: 1,
    revenueToDate: dollars(160_000),
    verdict,
    ...opts,
  };
}

describe("achievements catalog", () => {
  it("has a healthy number of milestones with unique ids", () => {
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(12);
    expect(ACHIEVEMENT_COUNT).toBeLessThanOrEqual(52);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every milestone has title, description, hint, and a resolvable icon", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(achievementById(a.id)).toBe(a);
    }
  });

  it("the empty/baseline facts unlock nothing", () => {
    expect(evaluateAchievements(emptyFacts())).toEqual([]);
  });
});

describe("each predicate fires only when its real condition is met", () => {
  const cases: { id: string; facts: Partial<AchievementFacts> }[] = [
    { id: "first-ship", facts: { productsShipped: 1 } },
    { id: "first-hit", facts: { hits: 1 } },
    { id: "sold-out", facts: { soldOut: true } },
    { id: "hat-trick", facts: { hitStreak: 3 } },
    { id: "ship-5", facts: { productsShipped: 5 } },
    { id: "ship-25", facts: { productsShipped: 25 } },
    { id: "ship-100", facts: { productsShipped: 100 } },
    { id: "rev-1m", facts: { cumulativeRevenue: 1_000_000 } },
    { id: "rev-10m", facts: { cumulativeRevenue: 10_000_000 } },
    { id: "rev-100m", facts: { cumulativeRevenue: 100_000_000 } },
    { id: "fans-10k", facts: { fans: 10_000 } },
    { id: "fans-100k", facts: { fans: 100_000 } },
    { id: "fans-1m", facts: { fans: 1_000_000 } },
    { id: "rep-50", facts: { reputation: 50 } },
    { id: "rep-85", facts: { reputation: 85 } },
    { id: "era-final", facts: { atFinalEra: true } },
    { id: "investor", facts: { rivalsInvested: 3 } },
    { id: "ipo", facts: { listed: true } },
    { id: "networth-1m", facts: { netWorth: 1_000_000 } },
    { id: "networth-100m", facts: { netWorth: 100_000_000 } },
    { id: "first-hire", facts: { staffCount: 2 } },
    { id: "team-5", facts: { staffCount: 5 } },
    { id: "hit-streak-5", facts: { hitStreak: 5 } },
    { id: "research-4", facts: { completedProjects: 4 } },
    { id: "research-all", facts: { completedProjects: 19 } },
    { id: "big-run", facts: { biggestRun: 50_000 } },
    { id: "gg", facts: { wentPublic: true } },
    { id: "first-research", facts: { completedProjects: 1 } },
    { id: "era-2", facts: { era2reached: true } },
    { id: "era-3", facts: { era3reached: true } },
    { id: "comeback-kid", facts: { comebackFromFlop: true } },
    { id: "diversified-mfg", facts: { categoriesShipped: 3 } },
    { id: "rev-1b", facts: { cumulativeRevenue: 1_000_000_000 } },
    { id: "team-10", facts: { staffCount: 10 } },
    { id: "all-rivals", facts: { rivalsInvested: 6 } },
    { id: "ship-10", facts: { productsShipped: 10 } },
    { id: "dual-category", facts: { categoriesShipped: 2 } },
    { id: "mega-run", facts: { biggestRun: 200_000 } },
    { id: "rev-500m", facts: { cumulativeRevenue: 500_000_000 } },
    { id: "networth-10m", facts: { netWorth: 10_000_000 } },
    { id: "flop-proof", facts: { productsShipped: 10, flops: 0 } },
    { id: "rep-75", facts: { reputation: 75 } },
    { id: "scenario-win", facts: { wonScenario: true } },
    { id: "challenge-done", facts: { completedChallenge: true } },
    { id: "os-release", facts: { releasedOsVersion: true } },
  ];

  it("covers the whole catalog", () => {
    expect(new Set(cases.map((c) => c.id))).toEqual(new Set(ACHIEVEMENTS.map((a) => a.id)));
  });

  for (const c of cases) {
    it(`${c.id} unlocks at its threshold and not below`, () => {
      const justEnough = { ...emptyFacts(), ...c.facts };
      expect(evaluateAchievements(justEnough)).toContain(c.id);
      // The baseline (no facts) must NOT unlock it.
      expect(evaluateAchievements(emptyFacts())).not.toContain(c.id);
    });
  }

  it("a single unit below a numeric threshold does not unlock", () => {
    expect(evaluateAchievements({ ...emptyFacts(), cumulativeRevenue: 999_999 })).not.toContain("rev-1m");
    expect(evaluateAchievements({ ...emptyFacts(), fans: 9_999 })).not.toContain("fans-10k");
    expect(evaluateAchievements({ ...emptyFacts(), reputation: 49 })).not.toContain("rep-50");
    expect(evaluateAchievements({ ...emptyFacts(), hitStreak: 2 })).not.toContain("hat-trick");
  });
});

describe("deriveFacts reads only real tracked state", () => {
  it("counts shipped products, hits, hit streak, and sellouts", () => {
    const s = newGame(1);
    // launched is newest-first: most recent two are hits, then a flop breaks the streak.
    const withLaunches: GameState = {
      ...s,
      launched: [
        launched("hit"),
        launched("hit"),
        launched("flop"),
        launched("hit"),
      ],
    };
    const f = deriveFacts(withLaunches);
    expect(f.productsShipped).toBe(4);
    expect(f.hits).toBe(3);
    expect(f.hitStreak).toBe(2); // broken by the flop
    expect(f.soldOut).toBe(false); // totalUnits(1000) < plannedUnits(2000) = not a sellout
  });

  it("detects a sellout when the run met demand (totalUnits === plannedUnits)", () => {
    const s = newGame(2);
    const sold: GameState = { ...s, launched: [launched("hit", { totalUnits: 2000, plannedUnits: 2000 })] };
    expect(deriveFacts(sold).soldOut).toBe(true);
  });

  it("counts only rivals with a positive holding", () => {
    const s = newGame(3);
    const invested: GameState = { ...s, holdings: { a: 5, b: 2, c: 0, d: 10 } };
    expect(deriveFacts(invested).rivalsInvested).toBe(3);
  });

  it("detects comebackFromFlop when a hit follows a flop in history", () => {
    const s = newGame(7);
    // launched is newest-first: index 0 = most recent
    // [hit, flop] = hit is newest (index 0), flop is older (index 1) → comeback
    const withComeback: GameState = {
      ...s,
      launched: [launched("hit"), launched("flop")],
    };
    expect(deriveFacts(withComeback).comebackFromFlop).toBe(true);
    // [flop, hit] = flop is newest, hit is older → NOT a comeback (no hit after the flop)
    const noComeback: GameState = {
      ...s,
      launched: [launched("flop"), launched("hit")],
    };
    expect(deriveFacts(noComeback).comebackFromFlop).toBe(false);
    // only a hit, no flop → no comeback
    expect(deriveFacts({ ...s, launched: [launched("hit")] }).comebackFromFlop).toBe(false);
  });

  it("counts distinct categories shipped", () => {
    const s = newGame(8);
    const multi: GameState = {
      ...s,
      launched: [
        launched("hit", { product: { ...product(), id: "p1", category: "phone" } }),
        launched("hit", { product: { ...product(), id: "p2", category: "tablet" } }),
        launched("hit", { product: { ...product(), id: "p3", category: "phone" } }),
      ],
    };
    expect(deriveFacts(multi).categoriesShipped).toBe(2);
  });
});

describe("evaluateAndUnlock is monotonic + idempotent (no double-unlock)", () => {
  it("a fresh game has no achievements and unlocks nothing", () => {
    const s = newGame(4);
    expect(s.unlockedAchievements).toEqual([]);
    const { state, unlocked } = evaluateAndUnlock(s);
    expect(unlocked).toEqual([]);
    expect(state).toBe(s); // referential stability when nothing changes
  });

  it("shipping a product unlocks first-ship exactly once", () => {
    const s: GameState = { ...newGame(5), launched: [launched("steady")] };
    const first = evaluateAndUnlock(s);
    expect(first.unlocked).toContain("first-ship");
    expect(first.state.unlockedAchievements).toContain("first-ship");
    // Re-running against the already-updated state must NOT re-report it.
    const second = evaluateAndUnlock(first.state);
    expect(second.unlocked).not.toContain("first-ship");
    expect(second.state).toBe(first.state); // no change → same object
    // The id appears only once in the set.
    expect(first.state.unlockedAchievements.filter((id) => id === "first-ship")).toHaveLength(1);
  });

  it("an already-unlocked milestone stays unlocked even if the stat later dips", () => {
    const s: GameState = { ...newGame(6), fans: 12_000 };
    const earned = evaluateAndUnlock(s);
    expect(earned.state.unlockedAchievements).toContain("fans-10k");
    // Fans crash, but the achievement was already banked — re-eval keeps it and reports nothing new.
    const later = evaluateAndUnlock({ ...earned.state, fans: 10 });
    expect(later.state.unlockedAchievements).toContain("fans-10k");
    expect(later.unlocked).toEqual([]);
  });
});

describe("newlyUnlocked diffs against the previous set", () => {
  it("returns only ids not previously held", () => {
    const facts = { ...emptyFacts(), productsShipped: 1, hits: 1 };
    expect(newlyUnlocked([], facts).sort()).toEqual(["first-hit", "first-ship"]);
    expect(newlyUnlocked(["first-ship"], facts)).toEqual(["first-hit"]);
    expect(newlyUnlocked(["first-ship", "first-hit"], facts)).toEqual([]);
  });
});
