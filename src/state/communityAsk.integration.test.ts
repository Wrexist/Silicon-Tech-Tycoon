// State-layer community asks: the answer/pass reducer + determinism safety (a do-nothing run — never
// launches — never raises an ask, matching the pinned sim).
import { describe, it, expect } from "vitest";
import { newGame, resolveCommunityAsk, advanceOneWeek, type GameState } from "./gameState.ts";
import { generateCommunityAsk, communityAskDue } from "../engine/community.ts";
import { dollars } from "../engine/money.ts";

describe("generateCommunityAsk", () => {
  it("is deterministic for a given (seed, week, fans)", () => {
    expect(generateCommunityAsk(7, 40, 10000)).toEqual(generateCommunityAsk(7, 40, 10000));
  });
  it("scales cost + fan-gain with the fanbase", () => {
    const small = generateCommunityAsk(7, 40, 1000);
    const big = generateCommunityAsk(7, 40, 500000);
    expect(big.cost).toBeGreaterThan(small.cost);
    expect(big.fanGain).toBeGreaterThan(small.fanGain);
  });
});

describe("resolveCommunityAsk", () => {
  it("answering spends the cash, grows the base, lifts the mood, clears the ask", () => {
    const ask = generateCommunityAsk(7, 40, 5000);
    const g = { ...newGame(7), cash: dollars(50_000_000), fans: 5000, fanSentiment: 0, pendingCommunityAsk: ask } as GameState;
    const { state, result } = resolveCommunityAsk(g, true);
    expect(result.ok).toBe(true);
    expect(result.answered).toBe(true);
    expect(state.cash).toBe(g.cash - ask.cost);
    expect(state.fans).toBe(5000 + ask.fanGain);
    expect(state.fanSentiment!).toBeGreaterThan(0);
    expect(state.pendingCommunityAsk).toBeNull();
  });

  it("can't answer without the cash — no-op error", () => {
    const ask = generateCommunityAsk(7, 40, 5000);
    const g = { ...newGame(7), cash: dollars(1), fans: 5000, pendingCommunityAsk: ask } as GameState;
    const { state, result } = resolveCommunityAsk(g, true);
    expect(result.ok).toBe(false);
    expect(state).toBe(g); // untouched
  });

  it("passing dips the mood a little and clears the ask (no cash/fan change)", () => {
    const ask = generateCommunityAsk(7, 40, 5000);
    const g = { ...newGame(7), fans: 5000, fanSentiment: 0.2, pendingCommunityAsk: ask } as GameState;
    const { state, result } = resolveCommunityAsk(g, false);
    expect(result.ok).toBe(true);
    expect(result.answered).toBe(false);
    expect(state.fanSentiment!).toBeLessThan(0.2);
    expect(state.fanSentiment!).toBeGreaterThanOrEqual(-1);
    expect(state.cash).toBe(g.cash);
    expect(state.fans).toBe(5000);
    expect(state.pendingCommunityAsk).toBeNull();
  });

  it("is a no-op with nothing pending", () => {
    const g = newGame(1);
    const { state, result } = resolveCommunityAsk(g, true);
    expect(result.ok).toBe(false);
    expect(state).toBe(g);
  });
});

describe("determinism safety", () => {
  it("a solo run that never launches never raises a community ask", () => {
    let s = { ...newGame(4242), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.pendingCommunityAsk ?? null).toBeNull();
  });
  it("communityAskDue is deterministic", () => {
    expect(communityAskDue(7, 40)).toBe(communityAskDue(7, 40));
  });
});
