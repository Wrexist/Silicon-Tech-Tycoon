import { describe, it, expect } from "vitest";
import { newGame, advanceOneWeek, companyValuation, type GameState } from "../state/gameState.ts";
import { BALANCE } from "./balance.ts";
import { dollars, toDollars } from "./money.ts";

// Track B: a bounded, mean-reverting momentum overlay makes the company's value react to launches.
// It must never touch cash (bankruptcy) or reputation (the win gate).

describe("performance-reactive company value (Track B)", () => {
  it("momentum swings companyValuation around the fundamental", () => {
    const base = { ...newGame(1), reputation: 80, cumulativeRevenue: dollars(50_000_000) };
    const neutral = toDollars(companyValuation({ ...base, valuationMomentum: 0 }));
    const popped = toDollars(companyValuation({ ...base, valuationMomentum: 0.1 }));
    const dipped = toDollars(companyValuation({ ...base, valuationMomentum: -0.1 }));
    expect(popped).toBeGreaterThan(neutral);
    expect(dipped).toBeLessThan(neutral);
    expect(popped / neutral).toBeCloseTo(1.1, 1);
  });

  it("momentum decays toward the fundamental each week, stays bounded, and records a sample", () => {
    let s: GameState = { ...newGame(2), onboarded: true, valuationMomentum: 0.15, cash: dollars(10_000_000) };
    const before = s.valuationMomentum!;
    s = advanceOneWeek(s);
    expect(s.valuationMomentum!).toBeLessThan(before); // mean-reverts
    expect(s.valuationMomentum!).toBeGreaterThanOrEqual(0);
    expect(Math.abs(s.valuationMomentum!)).toBeLessThanOrEqual(BALANCE.valuationMomentum.cap + 1e-9);
    expect((s.valuationHistory ?? []).length).toBeGreaterThan(0);
  });

  it("does NOT touch cash or reputation (bankruptcy + win gate are independent)", () => {
    const base = { ...newGame(4), onboarded: true, cash: dollars(5_000_000), reputation: 50, valuationMomentum: 0.12 };
    const next = advanceOneWeek(base);
    expect(next.reputation).toBe(base.reputation); // a quiet week with no launch/event leaves rep alone
    // cash only moves by ordinary burn, never by the valuation overlay
    expect(toDollars(next.cash)).toBeLessThanOrEqual(toDollars(base.cash));
  });

  it("old saves (no momentum field) read as a neutral fundamental valuation", () => {
    const base = { ...newGame(3), reputation: 70, cumulativeRevenue: dollars(20_000_000) };
    const withZero = toDollars(companyValuation({ ...base, valuationMomentum: 0 }));
    const without = toDollars(companyValuation({ ...base, valuationMomentum: undefined }));
    expect(without).toBe(withZero);
  });
});
