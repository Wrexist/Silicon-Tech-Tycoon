// State-layer challenge wiring: newChallengeGame applies date-seeded mutators, withChallengeScore
// locks the score at scoreWeek, challengeViewFor reports progress, and the per-date best store is
// monotonic. node env (no DOM) → stub localStorage, mirroring persistence.test.ts.
import { describe, it, expect, beforeEach } from "vitest";
import { newGame, newChallengeGame, withChallengeScore, challengeViewFor } from "./gameState.ts";
import { dailyChallenge, weeklyChallenge } from "../engine/challenges.ts";
import { toDollars, scale } from "../engine/money.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}
beforeEach(() => {
  // @ts-expect-error stub for node test env
  globalThis.localStorage = new MemStorage();
});

const DAY = "2026-06-19";

describe("newChallengeGame", () => {
  it("seeds from the date's challenge and applies its mutators to the start", () => {
    const ch = dailyChallenge(DAY);
    const g = newChallengeGame("daily", DAY);
    const base = newGame(ch.seed);

    // Expected start after applying mutators in order.
    let cash = base.cash, rep = base.reputation, fans = base.fans;
    for (const m of ch.mutators) {
      if (m.cashMult != null) cash = scale(cash, m.cashMult);
      if (m.reputation != null) rep = m.reputation;
      if (m.fans != null) fans = m.fans;
    }
    expect(toDollars(g.cash)).toBe(toDollars(cash));
    expect(g.reputation).toBe(rep);
    expect(g.fans).toBe(fans);
    expect(g.activeChallenge).toEqual({ kind: "daily", dateKey: DAY, scoreMetric: ch.scoreMetric, scoreWeek: ch.scoreWeek });
    expect(g.challengeScore).toBe(null);
    expect(g.onboarded).toBe(true);
    expect(g.cashHistory[0].cash).toBe(toDollars(cash));
  });

  it("weekly anchors to the week's Monday", () => {
    const g = newChallengeGame("weekly", DAY);
    expect(g.activeChallenge?.kind).toBe("weekly");
    expect(g.activeChallenge?.dateKey).toBe(weeklyChallenge(DAY).dateKey); // Monday
  });
});

describe("withChallengeScore", () => {
  it("does nothing before scoreWeek, locks the metric snapshot at/after it, and is idempotent", () => {
    const g0 = newChallengeGame("daily", DAY);
    const metric = g0.activeChallenge!.scoreMetric;
    const week = g0.activeChallenge!.scoreWeek;

    // Before the deadline: no score.
    expect(withChallengeScore({ ...g0, week: week - 1 }).challengeScore).toBe(null);

    // At the deadline: score locks to the current metric value.
    const atDeadline = withChallengeScore({ ...g0, week, reputation: 50, fans: 1234, cumulativeRevenue: g0.cumulativeRevenue });
    expect(atDeadline.challengeScore).not.toBe(null);

    // Idempotent — a second call doesn't move a locked score.
    const again = withChallengeScore({ ...atDeadline, week: week + 5 });
    expect(again.challengeScore).toBe(atDeadline.challengeScore);
    // For the fans metric specifically, the locked score equals the fan count at lock time.
    if (metric === "fans") expect(atDeadline.challengeScore).toBe(1234);
  });

  it("is a no-op for non-challenge runs", () => {
    const g = newGame(1);
    expect(withChallengeScore({ ...g, week: 999 }).challengeScore).toBe(null);
  });
});

describe("challengeViewFor", () => {
  it("is null for a normal run and a live view for a challenge run", () => {
    expect(challengeViewFor(newGame(1))).toBe(null);
    const g = newChallengeGame("daily", DAY);
    const view = challengeViewFor(g)!;
    expect(view.challenge.dateKey).toBe(DAY);
    expect(view.final).toBe(null);
    expect(view.weeksLeft).toBe(g.activeChallenge!.scoreWeek); // week 0
  });
});

describe("challenge best store", () => {
  it("keeps the highest score per key (monotonic) and tolerates corruption", async () => {
    const { recordChallengeBest, bestScore, challengeKey } = await import("./challengeProgress.ts");
    const key = challengeKey("daily", DAY);
    expect(bestScore(key)).toBe(null);
    expect(recordChallengeBest(key, 1000)).toEqual({ improved: true, best: 1000 });
    expect(recordChallengeBest(key, 500)).toEqual({ improved: false, best: 1000 });
    expect(recordChallengeBest(key, 2500)).toEqual({ improved: true, best: 2500 });
    expect(bestScore(key)).toBe(2500);

    localStorage.setItem("silicon.challengeBests.v1", "{broken");
    expect(bestScore(key)).toBe(null); // corrupt store reads as empty
  });

  it("never persists a non-finite score (no corruption)", async () => {
    const { recordChallengeBest, bestScore, challengeKey } = await import("./challengeProgress.ts");
    const key = challengeKey("daily", "2026-01-01");
    recordChallengeBest(key, 5000);
    expect(recordChallengeBest(key, NaN)).toEqual({ improved: false, best: 5000 });
    expect(recordChallengeBest(key, Infinity)).toEqual({ improved: false, best: 5000 });
    expect(bestScore(key)).toBe(5000); // unchanged
  });

  it("challengeHistory lists recorded results newest-first (kind-stable)", async () => {
    const { recordChallengeBest, challengeKey, challengeHistory } = await import("./challengeProgress.ts");
    recordChallengeBest(challengeKey("daily", "2026-06-19"), 100);
    recordChallengeBest(challengeKey("weekly", "2026-06-15"), 500);
    recordChallengeBest(challengeKey("daily", "2026-06-20"), 200);
    expect(challengeHistory().map((h) => `${h.kind}:${h.dateKey}`)).toEqual([
      "daily:2026-06-20",
      "daily:2026-06-19",
      "weekly:2026-06-15",
    ]);
  });
});
