// Global interrupt budget: opportunistic full-screen cards keep a minimum quiet gap between them so
// modals never cluster. Tested through the earnings path because it's fully deterministic (no
// derived-hash cadence), and for determinism safety through the pinned-style solo run (raises none).
import { describe, it, expect } from "vitest";
import { newGame, listCompany, advanceOneWeek, interruptPaceMultiplier, type GameState } from "./gameState.ts";
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

  it("item C2: the quiet gap is TIGHTER in the late eras (more happens in the wait)", () => {
    const late = BALANCE.interrupts.minGapWeeksLate;
    expect(late).toBeLessThan(GAP); // the late gap is genuinely shorter
    // A listed company advanced to a late era defers a due earnings call by only the SHORTER gap.
    let s = { ...listed(9), era: BALANCE.interrupts.lateEra } as GameState;
    for (let w = 0; w < SH.quarterWeeks - 1; w++) s = advanceOneWeek(s);
    s = { ...s, era: BALANCE.interrupts.lateEra, lastInterruptWeek: s.week } as GameState;
    // It waits only `late - 1` quiet weeks, then lands on the next — proving the tighter late gap.
    for (let w = 0; w < late - 1; w++) { s = advanceOneWeek(s); s = { ...s, era: BALANCE.interrupts.lateEra }; expect(s.pendingEarnings ?? null).toBeNull(); }
    s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull();
  });

  it("yields a due earnings call while ANY other interrupt card is still unresolved", () => {
    // Regression for the guard-drift fix: every opportunistic block gates on the shared
    // `noPendingInterrupt` predicate, so a due earnings call must NOT stack on top of an
    // unresolved card that has no auto-expiry (e.g. a post-launch event).
    let s = listed(3);
    for (let w = 0; w < SH.quarterWeeks + 1; w++) {
      // Keep a foreign interrupt pinned "open" the whole time — it never auto-clears.
      s = { ...s, pendingPostLaunch: { week: s.week, productId: "p", productName: "P", kind: "stall", title: "t", body: "b", options: [] } } as GameState;
      s = advanceOneWeek(s);
    }
    expect(s.pendingEarnings ?? null).toBeNull(); // deferred: the screen is busy

    // Clear the blocking card; the deferred earnings call lands on the next quiet week.
    s = { ...s, pendingPostLaunch: null } as GameState;
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

  it("Calm Mode multiplier: standard/undefined=1, relaxed=2, calm=3", () => {
    expect(interruptPaceMultiplier(undefined)).toBe(1);
    expect(interruptPaceMultiplier("standard")).toBe(1);
    expect(interruptPaceMultiplier("relaxed")).toBe(2);
    expect(interruptPaceMultiplier("calm")).toBe(3);
  });

  it("Calm Mode widens the shared quiet gap: a due earnings call waits the scaled gap", () => {
    // "calm" triples the gap; the deferred call must wait 3x as long as the Standard case above.
    const calmGap = GAP * 3;
    let s = { ...listed(11), interruptPace: "calm" } as GameState;
    for (let w = 0; w < SH.quarterWeeks - 1; w++) s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).toBeNull();
    // Stamp an interrupt as just fired, so the widened budget is "loud" right at the boundary.
    s = { ...s, lastInterruptWeek: s.week, interruptPace: "calm" } as GameState;
    // It must stay deferred across the FULL Standard gap and beyond — proof the gap really widened.
    for (let w = 0; w < calmGap - 1; w++) {
      s = advanceOneWeek(s);
      expect(s.pendingEarnings ?? null).toBeNull(); // still deferred well past the Standard gap
    }
    // The first quiet week after the tripled gap: the deferred call finally lands.
    s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull();
  });

  it("Calm Mode is opt-in: undefined pace behaves exactly like Standard", () => {
    // Same setup as the very first defer test, but assert the boundary matches the UNSCALED gap —
    // an absent interruptPace must not change timing at all (backward-compatible default).
    let s = listed(11);
    expect(s.interruptPace).toBeUndefined();
    for (let w = 0; w < SH.quarterWeeks - 1; w++) s = advanceOneWeek(s);
    s = { ...s, lastInterruptWeek: s.week } as GameState;
    for (let w = 0; w < GAP - 1; w++) {
      s = advanceOneWeek(s);
      expect(s.pendingEarnings ?? null).toBeNull();
    }
    s = advanceOneWeek(s);
    expect(s.pendingEarnings ?? null).not.toBeNull(); // lands on the standard gap, unchanged
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
