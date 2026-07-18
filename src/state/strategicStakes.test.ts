// Strategic Stakes — a rival share position as a strategic verb. Insider (10%) reveals hidden
// internals; a board seat (25%) unlocks a rare, cooldown-gated "delay their launch" nudge; a
// controlling stake (50%) buys them out cheap. All player-driven, so the pinned solo sim — which
// never trades — is byte-identical. Intel is a pure UI read (no state); only the nudge writes state.
import { describe, it, expect } from "vitest";
import {
  newGame,
  isInsider,
  hasBoardSeat,
  hasControllingStake,
  rivalBoardIntel,
  ownershipFractionOf,
  canBoardNudge,
  boardNudge,
  boardNudgeCooldownWeeks,
  advanceOneWeek,
  type GameState,
} from "./gameState.ts";
import { rivalDef } from "../engine/competitors.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

const T = BALANCE.mergers.takeover;
const RIVAL = "pomelo";
const FLOAT = rivalDef(RIVAL)!.shares;

function withStake(frac: number, seed = 11): GameState {
  return { ...newGame(seed), holdings: { [RIVAL]: Math.ceil(FLOAT * frac) }, cash: dollars(50_000_000_000) } as GameState;
}

// A norm that drops the churny feed + the wall-clock lastActive stamp, so byte-identical replay
// compares the deterministic sim state, not log strings or a timestamp.
function norm(s: GameState): unknown {
  return JSON.parse(JSON.stringify({ ...s, feed: s.feed.length, lastActive: 0 }));
}

describe("strategic-stakes thresholds (pure holdings math)", () => {
  it("insider unlocks at insiderFrac, board seat at boardSeatFrac, control at controlFrac", () => {
    expect(ownershipFractionOf(withStake(0.25), RIVAL)).toBeCloseTo(0.25, 3);
    expect(isInsider(withStake(T.insiderFrac - 0.01), RIVAL)).toBe(false);
    expect(isInsider(withStake(T.insiderFrac), RIVAL)).toBe(true);
    expect(hasBoardSeat(withStake(T.insiderFrac), RIVAL)).toBe(false); // insider is not yet a board seat
    expect(hasBoardSeat(withStake(T.boardSeatFrac), RIVAL)).toBe(true);
    expect(hasControllingStake(withStake(T.boardSeatFrac), RIVAL)).toBe(false);
    expect(hasControllingStake(withStake(T.controlFrac), RIVAL)).toBe(true);
  });

  it("insider intel reveals arc phase + weeks-to-launch + likely category; null below insider", () => {
    expect(rivalBoardIntel(withStake(T.insiderFrac - 0.01), RIVAL)).toBeNull();
    const intel = rivalBoardIntel(withStake(T.insiderFrac), RIVAL)!;
    expect(intel).not.toBeNull();
    expect(typeof intel.arcPhase).toBe("string");
    expect(intel.weeksToLaunch).toBeGreaterThanOrEqual(0);
    // The revealed "next category" is one of the rival's real preferred categories (genuine intent).
    expect(rivalDef(RIVAL)!.preferredCategories).toContain(intel.nextCategory);
  });
});

describe("board-seat nudge — cooldown + effect bounds", () => {
  it("delays the rival's next launch by exactly nudgeDelayWeeks and starts the cooldown", () => {
    const s = withStake(T.boardSeatFrac);
    const before = s.competitors.find((c) => c.id === RIVAL)!.nextLaunchWeek;
    expect(canBoardNudge(s, RIVAL)).toBe(true);
    expect(boardNudgeCooldownWeeks(s, RIVAL)).toBe(0);

    const after = boardNudge(s, RIVAL);
    const nlw = after.competitors.find((c) => c.id === RIVAL)!.nextLaunchWeek;
    expect(nlw).toBe(Math.max(before, s.week) + T.nudgeDelayWeeks);
    expect(after.boardNudges?.[RIVAL]).toBe(s.week);
    // No other rival moved.
    for (const c of after.competitors) {
      if (c.id === RIVAL) continue;
      expect(c.nextLaunchWeek).toBe(s.competitors.find((x) => x.id === c.id)!.nextLaunchWeek);
    }
  });

  it("re-nudging is blocked until the cooldown elapses, then re-arms", () => {
    const s = boardNudge(withStake(T.boardSeatFrac), RIVAL);
    expect(canBoardNudge(s, RIVAL)).toBe(false);
    expect(boardNudge(s, RIVAL)).toBe(s); // no-op while on cooldown
    expect(boardNudgeCooldownWeeks(s, RIVAL)).toBe(T.nudgeCooldownWeeks);

    // Fast-forward past the cooldown by hand-advancing the week clock; the nudge re-arms.
    const later = { ...s, week: s.week + T.nudgeCooldownWeeks } as GameState;
    expect(boardNudgeCooldownWeeks(later, RIVAL)).toBe(0);
    expect(canBoardNudge(later, RIVAL)).toBe(true);
  });

  it("a stake below a board seat cannot nudge", () => {
    const s = withStake(T.boardSeatFrac - 0.01);
    expect(canBoardNudge(s, RIVAL)).toBe(false);
    expect(boardNudge(s, RIVAL)).toBe(s); // no-op returns the same state untouched
  });
});

describe("strategic-stakes determinism", () => {
  it("a board-seat run that nudges then advances replays byte-identical twice", () => {
    const script = (seed: number) => {
      let s = withStake(T.boardSeatFrac, seed);
      s = advanceOneWeek(s);
      s = boardNudge(s, RIVAL);
      for (let w = 0; w < 12; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(2024);
    const b = script(2024);
    expect(a.rngState).toBe(b.rngState);
    expect(norm(a)).toEqual(norm(b));
  });

  it("a solo run never trades → no insider, no board seat, boardNudges stays empty", () => {
    let s = { ...newGame(777), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 120; w++) s = advanceOneWeek(s);
    expect(isInsider(s, RIVAL)).toBe(false);
    expect(hasBoardSeat(s, RIVAL)).toBe(false);
    expect(Object.keys(s.boardNudges ?? {}).length).toBe(0);
  });

  it("an old save with boardNudges absent is unaffected by the tick (no-op default)", () => {
    const start = { ...newGame(88), cash: dollars(20_000_000) } as GameState;
    delete (start as { boardNudges?: unknown }).boardNudges;
    let s = start;
    for (let w = 0; w < 20; w++) s = advanceOneWeek(s);
    // Never held a board seat → the field was never nudged → the clock stays empty.
    expect(Object.keys(s.boardNudges ?? {}).length).toBe(0);
  });
});
