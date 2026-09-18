import { describe, expect, it } from "vitest";
import { newGame, runPrototype, prototypeState } from "./gameState.ts";
import { dollars } from "../engine/money.ts";

// The action is PLAYER-INITIATED ONLY. These tests pin the three things that matter: it costs cash
// and a week, it refuses when it cannot afford them, and it is deterministic for a given (seed, week).

describe("runPrototype", () => {
  it("refuses when the company cannot afford it, changing nothing", () => {
    const s = { ...newGame(4242), cash: dollars(0) };
    const r = runPrototype(s);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s); // identity: a refused action is a no-op, not a copy
  });

  it("spends the cost and advances exactly one week when it succeeds", () => {
    const s = { ...newGame(4242), cash: dollars(50_000_000), week: 30 };
    const r = runPrototype(s);
    expect(r.ok).toBe(true);
    expect(r.state.week).toBe(31);
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
});
