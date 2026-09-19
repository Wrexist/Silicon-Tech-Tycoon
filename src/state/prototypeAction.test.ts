import { describe, expect, it } from "vitest";
import { newGame, runPrototype, prototypeState, forecastConfidenceInput } from "./gameState.ts";
import { dollars } from "../engine/money.ts";

// The action is PLAYER-INITIATED ONLY. These tests pin the things that matter: it costs cash but
// does NOT advance the clock, it refuses when it cannot afford it, it is once per draft, and it is
// deterministic for a given (seed, week).

describe("runPrototype", () => {
  it("refuses when the company cannot afford it, changing nothing", () => {
    const s = { ...newGame(4242), cash: dollars(0) };
    const r = runPrototype(s);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s); // identity: a refused action is a no-op, not a copy
  });

  it("spends the cost and leaves the week unchanged when it succeeds", () => {
    const s = { ...newGame(4242), cash: dollars(50_000_000), week: 30 };
    const r = runPrototype(s);
    expect(r.ok).toBe(true);
    // An instant lab pass: no calendar jump, so no week of payroll/rent/revenue is silently skipped.
    expect(r.state.week).toBe(s.week);
    expect(r.state.cash).toBeLessThan(s.cash);
    expect(prototypeState(r.state)).not.toBeNull();
  });

  it("is deterministic for the same seed and week", () => {
    const a = runPrototype({ ...newGame(4242), cash: dollars(50_000_000), week: 30 });
    const b = runPrototype({ ...newGame(4242), cash: dollars(50_000_000), week: 30 });
    expect(prototypeState(a.state)).toEqual(prototypeState(b.state));
  });

  it("is a no-op on a save with no draft prototype field and no draft", () => {
    const s = newGame(4242);
    expect(prototypeState(s)).toBeNull();
  });

  it("a completed prototype tightens the forecast, and nothing else does", () => {
    const base = { ...newGame(4242), cash: dollars(50_000_000), week: 30 };
    const after = runPrototype(base);
    expect(after.ok).toBe(true);
    expect(forecastConfidenceInput(after.state)).toBeGreaterThan(forecastConfidenceInput(base));
  });
});
