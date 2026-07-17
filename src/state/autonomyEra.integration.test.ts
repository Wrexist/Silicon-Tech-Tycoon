// Autonomy Era (feature #3, roadmap "Frontier Era") — the post-IPO 5th era, its Frontier-Tech gate,
// its two new categories, and the era-5 component tier. Everything is gated on going public + Frontier
// Tech, which the pinned solo sim never does — so the golden determinism pin (run separately) stays
// byte-identical; these tests pin the gating + content.
import { describe, it, expect } from "vitest";
import { newGame, canIPO, canAdvance, advanceEraAction, type GameState } from "./gameState.ts";
import { maxEra, isCategoryUnlocked, unlockedCategories } from "../engine/eras.ts";
import { CATEGORIES, maxTier, tierDef } from "../engine/catalogs.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

describe("Autonomy Era — era table + content", () => {
  it("adds a 5th era without disturbing the earlier ones", () => {
    expect(maxEra()).toBe(5);
    expect(BALANCE.eras[4].name).toBe("Autonomy Era");
    expect(BALANCE.eras[3].name).toBe("AI Era");
  });

  it("unlocks two new categories only at era 5", () => {
    expect(CATEGORIES.neuralband.unlockEra).toBe(5);
    expect(CATEGORIES.robot.unlockEra).toBe(5);
    for (const c of ["neuralband", "robot"] as const) {
      expect(isCategoryUnlocked(c, 4)).toBe(false);
      expect(isCategoryUnlocked(c, 5)).toBe(true);
    }
    // The era-1 category set is unchanged (no early-game ripple).
    expect(unlockedCategories(1)).toEqual(["phone", "tablet"]);
    expect(unlockedCategories(5)).toContain("neuralband");
    expect(unlockedCategories(5)).toContain("robot");
  });

  it("adds an era-5 component tier to every line (camera's era-4 gap is backfilled too)", () => {
    expect(maxTier("chip")).toBe(7);
    expect(maxTier("camera")).toBe(6); // was 4 — added era-4 + era-5 tiers
    // the top tier of each hardware line is now era 5
    for (const k of ["chip", "display", "battery", "materials", "software"] as const) {
      expect(tierDef(k, maxTier(k))!.era).toBe(5);
    }
    // a frontier chip maxes performance AND lifts ecosystem (a multi-stat frontier part)
    const chip5 = tierDef("chip", 7)!;
    expect(chip5.contributes.performance).toBe(100);
    expect((chip5.contributes.ecosystem ?? 0)).toBeGreaterThan(0);
  });
});

describe("Autonomy Era — IPO is NOT deadlocked by the new max era", () => {
  it("a company can still go public at the AI Era (era 4), below maxEra()", () => {
    const s: GameState = { ...newGame(1), era: 4, reputation: 90, wentPublic: false };
    expect(s.era).toBeLessThan(maxEra()); // era 4 < 5
    expect(canIPO(s)).toBe(true); // …yet IPO is still reachable (fixed era-4 gate)
  });
  it("still refuses IPO below the AI Era or without reputation", () => {
    expect(canIPO({ ...newGame(1), era: 3, reputation: 99 } as GameState)).toBe(false);
    expect(canIPO({ ...newGame(1), era: 4, reputation: 50 } as GameState)).toBe(false);
    expect(canIPO({ ...newGame(1), era: 4, reputation: 99, wentPublic: true } as GameState)).toBe(false);
  });
});

describe("Autonomy Era — the AI→Autonomy step is gated on going public + Frontier Tech", () => {
  const atEra4 = (over: Partial<GameState> = {}): GameState =>
    ({ ...newGame(2), era: 4, reputation: 99, cumulativeRevenue: dollars(1_000_000_000), ...over }) as GameState;

  it("a private company can NEVER advance to era 5, no matter its rep/revenue (determinism-safe)", () => {
    expect(canAdvance(atEra4({ wentPublic: false, frontierTier: 9 }))).toBe(false);
  });
  it("a public company needs the Frontier-Tech threshold to advance", () => {
    const thresh = BALANCE.autonomyEra.tierToAdvance;
    expect(canAdvance(atEra4({ wentPublic: true, frontierTier: thresh - 1 }))).toBe(false);
    expect(canAdvance(atEra4({ wentPublic: true, frontierTier: thresh }))).toBe(true);
  });
  it("advancing lands in the Autonomy Era, which is terminal", () => {
    const s = advanceEraAction(atEra4({ wentPublic: true, frontierTier: BALANCE.autonomyEra.tierToAdvance }));
    expect(s.era).toBe(5);
    expect(canAdvance(s)).toBe(false); // era 5 is the final era
  });
  it("eras 1–3 still advance on the normal rep/rev bars (unchanged)", () => {
    const e1 = { ...newGame(3), era: 1, reputation: 40 } as GameState; // rep OR rev at era 1
    expect(canAdvance(e1)).toBe(true);
    const e2 = { ...newGame(3), era: 2, reputation: 10, cumulativeRevenue: dollars(0) } as GameState;
    expect(canAdvance(e2)).toBe(false); // needs both rep + rev
  });
});
