// Global interrupt budget: opportunistic full-screen cards keep a minimum quiet gap between them so
// modals never cluster. Tested through the earnings path because it's fully deterministic (no
// derived-hash cadence), and for determinism safety through the pinned-style solo run (raises none).
import { describe, it, expect } from "vitest";
import { newGame, listCompany, advanceOneWeek, type GameState } from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

const GAP = BALANCE.interrupts.minGapWeeks;
const SH = BALANCE.ipo.shareholders;

// A listed company with nothing else competing for the interrupt slot (no products/staff), so the
// only card that can fire is the quarterly earnings call — a clean probe for the shared budget.
function listed(seed = 42): GameState {
  const s = { ...newGame(seed), cumulativeRevenue: dollars(3_000_000), cash: dollars(100_000_000), nextEventWeek: 9999 } as GameState;
  return listCompany(s, 0.3);
}

describe("interrupt budget", () => {
  it("defers a due earnings call while a recent interrupt is still inside the quiet gap", () => {
    let s = listed();
    // Advance to the week before the quarter boundary (no call yet: week < quarterWeeks).
    for (let w = 0; w < SH.quarterWeeks - 1; w++) s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).toBeNull();

    // Stamp an interrupt as having just fired, so the budget is "loud" right at the boundary.
    s = { ...s, lastInterruptWeek: s.week } as GameState;

    // Cross the boundary: the call is DUE (>= quarterWeeks) but must wait for a quiet week.
    for (let w = 0; w < GAP - 1; w++) {
      s = advanceOneWeek(s);
      expect(s.pendingEarnings ?? null).toBeNull(); // deferred, not lost
    }

    // The first quiet week after the gap: the deferred call finally lands.
    s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull();
  });

  it("a firing interrupt stamps the shared budget", () => {
    let s = listed(7);
    for (let w = 0; w < SH.quarterWeeks + 1; w++) s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull();
    // The earnings call consumed the budget the week it fired (same stamp as lastEarningsWeek).
    expect(s.lastInterruptWeek).toBe(s.lastEarningsWeek);
    expect(s.lastInterruptWeek).toBeGreaterThan(-999);
  });

  it("determinism: a solo run raises no OPPORTUNISTIC interrupt, and is byte-identical run-to-run", () => {
    const run = () => {
      let s = { ...newGame(555), cash: dollars(5_000_000) } as GameState;
      for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run();
    // The opportunistic cards (which the budget gates) never fire without player actions.
    expect(a.pendingEarnings ?? null).toBeNull();
    expect(a.pendingEureka ?? null).toBeNull();
    expect(a.pendingCommunityAsk ?? null).toBeNull();
    expect(a.pendingStrike ?? null).toBeNull();
    expect(a.pendingRivalry ?? null).toBeNull();
    // The only thing that stamps the budget in a solo run is the RNG-free scheduled awards fold —
    // which fires identically in every run, so the new field stays byte-identical.
    expect(run().lastInterruptWeek).toBe(a.lastInterruptWeek);
  });
});
