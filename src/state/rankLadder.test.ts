// Industry-rank ladder (item 5.3): the "next boss" directly above the player, and the gap to overtake.
import { describe, expect, it } from "vitest";
import { newGame, nextRankRival, industryLeaderboard, industryRank, companyValuation, type GameState } from "./gameState.ts";
import { toDollars } from "../engine/money.ts";

describe("rank ladder — nextRankRival (item 5.3)", () => {
  it("names the rival directly above with a non-negative gap, matching the leaderboard", () => {
    const g = newGame(5);
    const boss = nextRankRival(g);
    const board = industryLeaderboard(g);
    const myIdx = board.findIndex((e) => e.isPlayer);
    if (myIdx === 0) {
      expect(boss).toBeNull(); // already #1
    } else {
      expect(boss).not.toBeNull();
      expect(boss!.name).toBe(board[myIdx - 1].name);
      expect(boss!.rank).toBe(myIdx); // the boss sits at rank = player's index (1-based one above)
      expect(toDollars(boss!.gap)).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns null once the player is #1 in the industry", () => {
    // Drive the player's valuation sky-high so they top the board.
    const g: GameState = { ...newGame(5), cumulativeRevenue: 9_999_999_999_00 as GameState["cumulativeRevenue"], reputation: 100 };
    expect(industryRank(g)).toBe(1);
    expect(nextRankRival(g)).toBeNull();
    expect(toDollars(companyValuation(g))).toBeGreaterThan(0);
  });

  it("closing the gap to the boss lowers the player's rank number (climbs the ladder)", () => {
    const weak = newGame(5);
    const strong: GameState = { ...weak, cumulativeRevenue: (toDollars(weak.cumulativeRevenue) + 500_000_000) * 100 as GameState["cumulativeRevenue"], reputation: 95 };
    expect(industryRank(strong)).toBeLessThanOrEqual(industryRank(weak));
  });
});
