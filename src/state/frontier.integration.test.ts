// Frontier Tech reducer + that a bought tier folds through prestigeBonuses into the live selectors,
// and that an un-advanced frontier is byte-identical (the determinism guarantee).
import { describe, expect, it } from "vitest";
import { newGame, buyFrontierTier, prestigeBonuses, type GameState } from "./gameState.ts";
import { frontierCost, frontierBonuses } from "../engine/frontier.ts";
import { dollars } from "../engine/money.ts";

function publicCo(legacyPoints: number): GameState {
  return { ...newGame(1), wentPublic: true, legacyPoints, cash: dollars(10_000_000) } as GameState;
}

describe("frontier tech — reducer", () => {
  it("is gated on going public", () => {
    const res = buyFrontierTier({ ...newGame(1), legacyPoints: 999 } as GameState);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/going public/i);
  });

  it("rejects when the player can't afford the next tier", () => {
    const res = buyFrontierTier(publicCo(frontierCost(0) - 1));
    expect(res.ok).toBe(false);
    expect(res.state.frontierTier ?? 0).toBe(0); // unchanged
  });

  it("spends the escalating cost and advances the tier", () => {
    let s = publicCo(100);
    const c0 = frontierCost(0);
    let res = buyFrontierTier(s);
    expect(res.ok).toBe(true);
    expect(res.state.frontierTier).toBe(1);
    expect(res.state.legacyPoints).toBe(100 - c0);
    // second tier costs more than the first
    res = buyFrontierTier(res.state);
    expect(res.state.frontierTier).toBe(2);
    expect(res.state.legacyPoints).toBe(100 - c0 - frontierCost(1));
    expect(frontierCost(1)).toBeGreaterThan(c0);
  });

  it("a bought tier raises the aggregated prestige bonus", () => {
    const before = prestigeBonuses(publicCo(100));
    const after = prestigeBonuses(buyFrontierTier(publicCo(100)).state);
    expect(after.rpMult).toBeGreaterThan(before.rpMult);
    expect(after.hype).toBeGreaterThan(before.hype);
  });

  it("determinism: an un-advanced frontier is the neutral no-op", () => {
    const s = newGame(1); // no frontierTier, never public
    expect(s.frontierTier).toBeUndefined();
    expect(frontierBonuses(s.frontierTier)).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 });
    // prestigeBonuses of a fresh game equals the same game with an explicit frontierTier: 0.
    const withZero = { ...s, frontierTier: 0 } as GameState;
    expect(prestigeBonuses(withZero)).toEqual(prestigeBonuses(s));
  });
});
