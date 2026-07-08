// Controlling-stake takeovers: accumulating a rival's shares earns a board seat (intel) and, past a
// controlling stake, a hostile buyout at a reduced premium. All player-driven (buy/acquire), so the
// pinned solo sim — which never trades — is untouched.
import { describe, it, expect } from "vitest";
import {
  newGame, buyShares, acquisitionCost, ownershipFractionOf, hasBoardSeat, hasControllingStake,
  rivalBoardIntel, advanceOneWeek, type GameState,
} from "./gameState.ts";
import { rivalDef, rivalMarketCap } from "../engine/competitors.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars, cents, scale, sub, toDollars } from "../engine/money.ts";

const T = BALANCE.mergers.takeover;
const RIVAL = "pomelo";
const FLOAT = rivalDef(RIVAL)!.shares;

function withHoldings(frac: number, seed = 3): GameState {
  return { ...newGame(seed), holdings: { [RIVAL]: Math.ceil(FLOAT * frac) }, cash: dollars(50_000_000_000) } as GameState;
}

describe("ownership thresholds", () => {
  it("ownershipFractionOf is shares held ÷ the rival's float", () => {
    expect(ownershipFractionOf(withHoldings(0.25), RIVAL)).toBeCloseTo(0.25, 3);
    expect(ownershipFractionOf(newGame(3), RIVAL)).toBe(0);
  });

  it("a board seat unlocks at boardSeatFrac; a controlling stake at controlFrac", () => {
    const belowBoard = withHoldings(T.boardSeatFrac - 0.02);
    const board = withHoldings(T.boardSeatFrac);
    const control = withHoldings(T.controlFrac);
    expect(hasBoardSeat(belowBoard, RIVAL)).toBe(false);
    expect(hasBoardSeat(board, RIVAL)).toBe(true);
    expect(hasControllingStake(board, RIVAL)).toBe(false);
    expect(hasControllingStake(control, RIVAL)).toBe(true);
  });

  it("board intel is hidden until you hold a board seat, then reveals arc phase + next launch", () => {
    expect(rivalBoardIntel(withHoldings(T.boardSeatFrac - 0.02), RIVAL)).toBeNull();
    const intel = rivalBoardIntel(withHoldings(T.boardSeatFrac), RIVAL);
    expect(intel).not.toBeNull();
    expect(typeof intel!.arcPhase).toBe("string");
    expect(typeof intel!.nextLaunchWeek).toBe("number");
  });
});

describe("hostile takeover discount", () => {
  it("a controlling stake buys the rival out below the full-premium price at the same holdings", () => {
    const s = withHoldings(T.controlFrac);
    const comp = s.competitors.find((c) => c.id === RIVAL)!;
    // The standard (non-controlling) formula at these exact holdings:
    const standardNet = toDollars(sub(scale(rivalMarketCap(comp), BALANCE.mergers.acquisitionPremium), cents((s.holdings[RIVAL] ?? 0) * comp.sharePrice)));
    expect(toDollars(acquisitionCost(s, RIVAL)!)).toBeLessThan(standardNet);
  });

  it("cost falls as the stake grows and control is crossed", () => {
    const half = toDollars(acquisitionCost(withHoldings(0.3), RIVAL)!);
    const controlled = toDollars(acquisitionCost(withHoldings(T.controlFrac), RIVAL)!);
    expect(controlled).toBeLessThan(half);
  });
});

describe("threshold-crossing feedback", () => {
  it("buying past a board seat announces it in the feed", () => {
    const justUnder = withHoldings(T.boardSeatFrac - 0.01);
    const before = justUnder.feed.length;
    const after = buyShares(justUnder, RIVAL, Math.ceil(FLOAT * 0.02));
    expect(hasBoardSeat(after, RIVAL)).toBe(true);
    expect(after.feed.length).toBeGreaterThan(before);
    expect(after.feed[after.feed.length - 1].text).toMatch(/board seat/i);
  });

  it("buying past a controlling stake announces the hostile-buyout option", () => {
    const justUnder = withHoldings(T.controlFrac - 0.01);
    const after = buyShares(justUnder, RIVAL, Math.ceil(FLOAT * 0.02));
    expect(hasControllingStake(after, RIVAL)).toBe(true);
    expect(after.feed[after.feed.length - 1].text).toMatch(/controlling stake/i);
  });
});

describe("determinism safety", () => {
  it("a solo run never trades → no board seats, no ownership", () => {
    let s = { ...newGame(777), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 120; w++) s = advanceOneWeek(s);
    expect(ownershipFractionOf(s, RIVAL)).toBe(0);
    expect(hasBoardSeat(s, RIVAL)).toBe(false);
  });
});
