import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import { rivalMarketCap } from "../engine/competitors.ts";
import {
  newGame,
  advanceOneWeek,
  industryLeaderboard,
  industryRank,
  type GameState,
} from "./gameState.ts";

describe("industry leaderboard", () => {
  it("a fresh garage company ranks dead last behind the six public rivals", () => {
    const s = newGame(1);
    const board = industryLeaderboard(s);
    expect(board).toHaveLength(7); // player + 6 rivals
    expect(industryRank(s)).toBe(7);
    expect(board[board.length - 1].isPlayer).toBe(true); // player is last
    expect(s.bestIndustryRank).toBe(7);
  });

  it("rival market caps are ordered (the premium giant is worth far more than the scrappy challenger)", () => {
    const s = newGame(2);
    const cap = (id: string) => toDollars(rivalMarketCap(s.competitors.find((c) => c.id === id)!));
    expect(cap("pomelo")).toBeGreaterThan(cap("quantyx"));
    expect(cap("pomelo")).toBeGreaterThan(cap("pandacore"));
    // the giant is a multi-hundred-million / billion-scale company
    expect(cap("pomelo")).toBeGreaterThan(1_000_000_000);
  });

  it("a dominant company ranks #1 in the industry", () => {
    // A huge cumulative revenue drives company valuation past every rival.
    const s: GameState = { ...newGame(3), cumulativeRevenue: dollars(5_000_000_000), reputation: 100 };
    expect(industryRank(s)).toBe(1);
    expect(industryLeaderboard(s)[0].isPlayer).toBe(true);
  });

  it("climbing to a new best rank celebrates overtaking rivals + records the new best", () => {
    // Start ranked last, then jump valuation so a live tick detects the climb and fires feed items.
    let s: GameState = { ...newGame(4), cumulativeRevenue: dollars(900_000_000), reputation: 100 };
    // bestIndustryRank is still 7 from newGame, but actual rank is now near the top.
    const liveRank = industryRank(s);
    expect(liveRank).toBeLessThan(7);
    const feedBefore = s.feed.length;
    s = advanceOneWeek(s);
    expect(s.bestIndustryRank).toBeLessThanOrEqual(liveRank);
    // at least one "overtook" celebration landed in the feed
    expect(s.feed.length).toBeGreaterThan(feedBefore);
    expect(s.feed.some((f) => /overtook|#1 company/.test(f.text))).toBe(true);
  });

  it("best rank is monotonic — a later quiet tick does not re-fire or regress it", () => {
    let s: GameState = { ...newGame(5), cumulativeRevenue: dollars(3_000_000_000), reputation: 100 };
    s = advanceOneWeek(s); // climb + celebrate
    const best = s.bestIndustryRank;
    const feedLen = s.feed.length;
    s = advanceOneWeek(s); // nothing new to overtake
    expect(s.bestIndustryRank).toBe(best);
    // no new overtake lines on the quiet tick (feed may grow from other events, but not overtakes)
    const newOvertakes = s.feed.slice(feedLen).filter((f) => /overtook/.test(f.text));
    expect(newOvertakes).toHaveLength(0);
  });
});
