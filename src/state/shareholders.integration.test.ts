// State-layer shareholder loop: quarterly earnings judging, buybacks, the defend-on-miss reducer,
// and determinism safety (a solo run never IPOs → the loop never runs, matching the pinned sim).
import { describe, it, expect } from "vitest";
import { newGame, listCompany, buybackShares, resolveEarnings, companyValuation, advanceOneWeek, canList, type GameState } from "./gameState.ts";
import { judgeQuarter, nextExpectation } from "../engine/shareholders.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars, toDollars } from "../engine/money.ts";

const SH = BALANCE.ipo.shareholders;

describe("shareholders engine", () => {
  it("judgeQuarter beats above expectation (price up) and misses below (price down)", () => {
    expect(judgeQuarter(1, 60, dollars(120), dollars(100)).beat).toBe(true);
    expect(judgeQuarter(1, 60, dollars(120), dollars(100)).priceMovePct).toBeGreaterThan(0);
    expect(judgeQuarter(1, 60, dollars(50), dollars(100)).beat).toBe(false);
    expect(judgeQuarter(1, 60, dollars(50), dollars(100)).priceMovePct).toBeLessThan(0);
  });
  it("clamps the price move to ±maxPriceMove", () => {
    expect(judgeQuarter(1, 60, dollars(1e9), dollars(1)).priceMovePct).toBeLessThanOrEqual(SH.maxPriceMove + 1e-9);
    expect(judgeQuarter(1, 60, dollars(0), dollars(1e9)).priceMovePct).toBeGreaterThanOrEqual(-SH.maxPriceMove - 1e-9);
  });
  it("nextExpectation grows the delivered quarter and floors at the minimum", () => {
    expect(toDollars(nextExpectation(dollars(1_000_000)))).toBeCloseTo(1_000_000 * (1 + SH.expectedGrowth), 0);
    expect(nextExpectation(dollars(0))).toBe(SH.minExpectation);
  });
});

describe("listCompany initializes the shareholder loop", () => {
  it("sets the quarter tracking + a first expectation", () => {
    const s0 = { ...newGame(3), cumulativeRevenue: dollars(2_000_000) } as GameState;
    expect(canList(s0)).toBe(true);
    const s = listCompany(s0, 0.2);
    expect(s.listed).toBe(true);
    expect(s.lastEarningsWeek).toBe(s.week);
    expect(s.quarterStartRevenue).toBe(s.cumulativeRevenue);
    expect((s.earningsExpectation ?? 0)).toBeGreaterThanOrEqual(SH.minExpectation);
  });
});

function listed(seed = 3): GameState {
  // nextEventWeek pushed out so an event-chain choice can't occupy the interrupt slot on the exact
  // quarter boundary (no products/staff here, so nothing else competes).
  const s = { ...newGame(seed), cumulativeRevenue: dollars(3_000_000), cash: dollars(100_000_000), nextEventWeek: 9999 } as GameState;
  return listCompany(s, 0.3); // → ownership 0.7
}

describe("buybackShares", () => {
  it("raises ownership, spends cash, and nudges the price up", () => {
    const s = listed();
    const amount = dollars(Math.round(toDollars(companyValuation(s)) * 0.05));
    const { state, result } = buybackShares(s, amount);
    expect(result.ok).toBe(true);
    expect(state.ownership).toBeGreaterThan(s.ownership);
    expect(state.cash).toBeLessThan(s.cash);
    expect(state.valuationMomentum ?? 0).toBeGreaterThan(s.valuationMomentum ?? 0);
  });
  it("no-op if not listed", () => {
    const s = newGame(3);
    const { state, result } = buybackShares(s, dollars(1000));
    expect(result.ok).toBe(false);
    expect(state).toBe(s);
  });
  it("caps ownership at maxOwnership", () => {
    const s = { ...listed(), ownership: SH.maxOwnership - 0.0001, cash: dollars(10_000_000_000) } as GameState;
    expect(buybackShares(s, dollars(9_000_000_000)).result.ok).toBe(false);
  });
});

describe("resolveEarnings", () => {
  it("a beat just clears the call", () => {
    const rep = judgeQuarter(1, 20, dollars(200), dollars(100));
    const s = { ...newGame(3), listed: true, pendingEarnings: rep } as GameState;
    const { state, result } = resolveEarnings(s, false);
    expect(result.ok).toBe(true);
    expect(state.pendingEarnings).toBeNull();
  });
  it("a miss + defend buys back; a miss + ride just clears", () => {
    const rep = judgeQuarter(1, 20, dollars(50), dollars(100));
    const base = { ...listed(), pendingEarnings: rep, cash: dollars(1_000_000_000) } as GameState;
    const defend = resolveEarnings(base, true);
    expect(defend.state.pendingEarnings).toBeNull();
    expect(defend.state.ownership).toBeGreaterThan(base.ownership);
    const ride = resolveEarnings(base, false);
    expect(ride.state.pendingEarnings).toBeNull();
    expect(ride.state.ownership).toBe(base.ownership);
  });
});

describe("quarterly cadence", () => {
  it("a listed company gets an earnings call after quarterWeeks", () => {
    let s = listed(5);
    for (let w = 0; w < SH.quarterWeeks + 3; w++) s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull();
  });
});

describe("determinism safety", () => {
  it("a solo run never IPOs → no earnings call ever fires", () => {
    let s = { ...newGame(999), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.listed).toBe(false);
    expect(s.pendingEarnings ?? null).toBeNull();
  });
});
