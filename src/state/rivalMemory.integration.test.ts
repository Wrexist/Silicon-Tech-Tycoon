// State-layer rival head-to-head MEMORY (engine/rivalMemory.ts): answered strikes, duel outcomes and
// buyouts are remembered per rival; a run that never interacts (and every old save, where the field
// is simply absent) never grows the record — the pinned do-nothing sim stays byte-identical.
import { describe, it, expect } from "vitest";
import {
  newGame,
  advanceOneWeek,
  resolveStrike,
  acquireRival,
  canAcquire,
  type GameState,
  type RivalStrike,
} from "./gameState.ts";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Nemesis } from "../engine/nemesis.ts";
import { recordRival } from "../engine/rivalMemory.ts";

const WINDOW = BALANCE.competitors.nemesis.duel.windowWeeks;

function strike(rivalId: string, over: Partial<RivalStrike> = {}): RivalStrike {
  return {
    week: 10, rivalId, rivalName: "Rival Co", rivalProductName: "Their Phone", rivalOverall: 50,
    category: "phone", productId: "p-mine", productName: "My Phone", playerOverall: 60, ...over,
  };
}

function nem(rivalId: string, week: number): Nemesis {
  return { rivalId, sinceWeek: week, heat: 60, peakHeat: 60, playerWins: 1, rivalWins: 0, lastClashWeek: week };
}

describe("rival memory — answered strikes", () => {
  it("a repelled hold is remembered as a weathered strike + a win (creating the record)", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const g = { ...base, week: 12, pendingStrike: strike(rid) } as GameState;
    expect(g.rivalHistory).toBeUndefined(); // old-save shape: the field simply doesn't exist yet
    const res = resolveStrike(g, "hold"); // playerOverall 60 >= 50 → repelled
    expect(res.ok).toBe(true);
    expect(res.state.rivalHistory![rid]).toMatchObject({ strikesWeathered: 1, wins: 1, losses: 0, lastWeek: 12 });
  });

  it("a losing hold banks the loss for them; paying to answer banks a win", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const losing = resolveStrike(
      { ...base, week: 12, pendingStrike: strike(rid, { playerOverall: 40, rivalOverall: 55 }) } as GameState,
      "hold",
    );
    expect(losing.state.rivalHistory![rid]).toMatchObject({ strikesWeathered: 1, wins: 0, losses: 1 });
  });

  it("accumulates across strikes from the same rival, on top of an existing record", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const prior = recordRival(undefined, rid, 8, "strike");
    const res = resolveStrike({ ...base, week: 12, rivalHistory: prior, pendingStrike: strike(rid) } as GameState, "hold");
    expect(res.state.rivalHistory![rid]).toMatchObject({ strikes: 1, strikesWeathered: 1, wins: 1 });
  });

  it("everything else about the resolution is unchanged by the memory (old saves act identically)", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const g = { ...base, week: 12, pendingStrike: strike(rid) } as GameState;
    const res = resolveStrike(g, "hold");
    // The record is additive: strip it and the result is exactly the pre-memory resolution.
    const { rivalHistory, ...rest } = res.state;
    expect(rivalHistory).toBeDefined();
    expect(rest.pendingStrike).toBeNull();
    expect(rest.lastStrikeWeek).toBe(12);
    expect(rest.reputation).toBe(g.reputation + BALANCE.market.competition.strike.holdRepBonus);
  });
});

describe("rival memory — duels and buyouts", () => {
  it("a won duel window files a duel trophy against that rival", () => {
    let s = {
      ...newGame(321), cash: dollars(50_000_000), cumulativeRevenue: dollars(5_000_000_000), wentPublic: true,
    } as GameState;
    const rid = s.competitors[0].id;
    s = { ...s, nemesis: nem(rid, s.week) } as GameState;
    for (let w = 0; w < WINDOW + 4; w++) s = advanceOneWeek(s);
    expect(s.nemesisTrophies).toBe(1);
    expect(s.rivalHistory![rid].duelsWon).toBe(1);
  });

  it("a lapsed duel window files a duel lost", () => {
    let s = { ...newGame(654), cash: dollars(10_000_000), cumulativeRevenue: dollars(0), reputation: 8 } as GameState;
    const rid = s.competitors[0].id;
    s = { ...s, nemesis: nem(rid, s.week) } as GameState;
    for (let w = 0; w < WINDOW + 4; w++) s = advanceOneWeek(s);
    expect(s.nemesisTrophies ?? 0).toBe(0);
    expect(s.rivalHistory![rid].duelsLost).toBeGreaterThanOrEqual(1);
    expect(s.rivalHistory![rid].duelsWon).toBe(0);
  });

  it("a buyout stamps acquiredWeek on the rival's file, keeping what was already there", () => {
    const s = {
      ...newGame(7), cumulativeRevenue: dollars(2_000_000), cash: dollars(500_000_000),
      rivalHistory: recordRival(undefined, "quantyx", 20, "win"),
    } as GameState;
    expect(canAcquire(s, "quantyx")).toBe(true);
    const a = acquireRival(s, "quantyx");
    expect(a.rivalHistory!.quantyx).toMatchObject({ wins: 1, acquiredWeek: s.week });
  });
});

describe("rival memory — inert without interaction (old saves + the pinned sim)", () => {
  it("a do-nothing run never creates the record", () => {
    let s = newGame(42);
    for (let w = 0; w < 30; w++) s = advanceOneWeek(s);
    expect(s.rivalHistory).toBeUndefined();
  });

  it("a run with memory replays byte-for-byte (the fold draws no RNG)", () => {
    const play = (seed: number): GameState => {
      let s = {
        ...newGame(seed), cash: dollars(50_000_000), cumulativeRevenue: dollars(5_000_000_000), wentPublic: true,
      } as GameState;
      s = { ...s, nemesis: nem(s.competitors[0].id, s.week) } as GameState;
      for (let w = 0; w < WINDOW + 6; w++) s = advanceOneWeek(s);
      return s;
    };
    const norm = (s: GameState) => ({ ...s, lastActive: 0, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) });
    const a = play(99);
    const b = play(99);
    expect(a.rivalHistory).toBeDefined(); // the duel judged → something is on file
    expect(norm(b)).toEqual(norm(a));
  });
});
