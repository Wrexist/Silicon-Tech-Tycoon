// State-layer Nemesis Boss ladder (feature #7): the tick arms a duel while a nemesis stands, judges it
// at the window's close (out-value them by a tier/ascension-scaled margin), and escalates the ladder on
// a win. Determinism is the headline: a run WITH the duel active replays byte-for-byte, and the golden
// do-nothing run — which never forms a nemesis → never arms a duel — is untouched.
import { describe, it, expect } from "vitest";
import { newGame, advanceOneWeek, type GameState } from "./gameState.ts";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Nemesis } from "../engine/nemesis.ts";

const WINDOW = BALANCE.competitors.nemesis.duel.windowWeeks;

function nem(rivalId: string, week: number): Nemesis {
  return { rivalId, sinceWeek: week, heat: 60, peakHeat: 60, playerWins: 1, rivalWins: 0, lastClashWeek: week };
}

// Normalize for run-to-run comparison: strip feed ids (they embed a module-level counter that keeps
// counting across two in-process runs) and lastActive (a wall-clock stamp two newGame calls differ on),
// so the rest can be compared bit-for-bit.
function norm(s: GameState) {
  return { ...s, lastActive: 0, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
}

describe("nemesis duel — arming + progress", () => {
  it("arms a duel on the first tick a nemesis stands (no new interrupt consumed)", () => {
    let s = { ...newGame(123), cash: dollars(20_000_000), cumulativeRevenue: dollars(3_000_000) } as GameState;
    const rid = s.competitors[0].id;
    s = { ...s, nemesis: nem(rid, s.week) } as GameState;
    const budgetBefore = s.lastInterruptWeek ?? -999;
    s = advanceOneWeek(s);
    expect(s.nemesisDuel).not.toBeNull();
    expect(s.nemesisDuel!.rivalId).toBe(rid);
    expect(s.nemesisDuel!.endWeek - s.nemesisDuel!.startWeek).toBe(WINDOW);
    // The duel is NOT an opportunistic interrupt — it must not consume the shared budget on arming.
    expect(s.lastInterruptWeek ?? -999).toBe(budgetBefore);
  });

  it("dissolves the duel if the nemesis leaves (field pruned)", () => {
    let s = { ...newGame(5), cash: dollars(20_000_000) } as GameState;
    s = { ...s, nemesis: nem("ghost-that-does-not-exist", s.week) } as GameState;
    s = advanceOneWeek(s);
    // updateNemesis prunes a nemesis pointing at a missing rival → the duel dissolves with it.
    expect(s.nemesis ?? null).toBeNull();
    expect(s.nemesisDuel ?? null).toBeNull();
  });
});

describe("nemesis duel — resolution + ladder", () => {
  it("winning the window banks a trophy, escalates the tier, pays a modest reward + a legacy point post-IPO", () => {
    // A dominant, public company (huge cumulative revenue → valuation dwarfs any rival) out-values its
    // arch-rival, so the duel resolves as a win when the window closes.
    let s = {
      ...newGame(321), cash: dollars(50_000_000), cumulativeRevenue: dollars(5_000_000_000), wentPublic: true,
    } as GameState;
    const rid = s.competitors[0].id;
    const repBefore = s.reputation;
    const fansBefore = s.fans;
    s = { ...s, nemesis: nem(rid, s.week) } as GameState;
    for (let w = 0; w < WINDOW + 4; w++) s = advanceOneWeek(s);
    expect(s.nemesisTrophies).toBe(1);
    expect(s.nemesisLadderTier).toBe(1); // climbed one rung
    expect(s.legacyPoints).toBe(1);      // one legacy point, post-IPO
    expect(s.reputation).toBeGreaterThan(repBefore);
    expect(s.fans).toBeGreaterThan(fansBefore);
    // A trophy celebration is staged (an earned ceremony, dismissed by the player).
    expect(s.pendingNemesisTrophy).not.toBeNull();
    expect(s.pendingNemesisTrophy!.rivalName).toBeTruthy();
    // The ladder re-arms immediately at the higher tier — the chase never ends.
    expect(s.nemesisDuel).not.toBeNull();
    expect(s.nemesisDuel!.tier).toBe(1);
  });

  it("losing the window costs nothing but a taunt and re-arms at the SAME tier", () => {
    // A garage brand (no revenue, rep 8) can't out-value a public giant → the duel resolves as a loss.
    let s = { ...newGame(654), cash: dollars(10_000_000), cumulativeRevenue: dollars(0), reputation: 8 } as GameState;
    const rid = s.competitors[0].id; // pomelo — the biggest rival by market cap
    s = { ...s, nemesis: nem(rid, s.week) } as GameState;
    const startWeekArmed = advanceOneWeek(s).nemesisDuel!.startWeek;
    for (let w = 0; w < WINDOW + 4; w++) s = advanceOneWeek(s);
    // The duel itself levies no penalty: no trophy, no escalation, no celebration (only a feed taunt).
    expect(s.nemesisTrophies ?? 0).toBe(0);       // no trophy
    expect(s.nemesisLadderTier ?? 0).toBe(0);     // no escalation
    expect(s.pendingNemesisTrophy ?? null).toBeNull(); // no celebration
    // Re-armed at the same tier for another go (a fresh, later window).
    expect(s.nemesisDuel).not.toBeNull();
    expect(s.nemesisDuel!.tier).toBe(0);
    expect(s.nemesisDuel!.startWeek).toBeGreaterThan(startWeekArmed);
  });
});

describe("nemesis duel — determinism", () => {
  it("a run with the duel active is byte-identical when replayed from the same start", () => {
    const start = { ...newGame(999), cash: dollars(20_000_000), cumulativeRevenue: dollars(3_000_000) } as GameState;
    const seeded = { ...start, nemesis: nem(start.competitors[0].id, start.week) } as GameState;
    const clone = structuredClone(seeded);
    const run = (s0: GameState) => {
      let s = s0;
      for (let w = 0; w < 40; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(seeded);
    const b = run(clone);
    expect(norm(b)).toEqual(norm(a));
    // Prove the horizon actually exercised the duel (armed + resolved at least once).
    expect(a.nemesisDuel).not.toBeNull();
    expect((a.nemesisTrophies ?? 0) + ((a.nemesisDuel!.startWeek > seeded.week) ? 1 : 0)).toBeGreaterThan(0);
  });

  it("the golden do-nothing run never forms a nemesis → never arms a duel → stays byte-identical", () => {
    const run = () => {
      let s = { ...newGame(7777), cash: dollars(5_000_000) } as GameState;
      for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run();
    // No clash in a do-nothing run → no nemesis → the entire ladder stays dormant/absent.
    expect(a.nemesis ?? null).toBeNull();
    expect(a.nemesisDuel ?? null).toBeNull();
    expect(a.pendingNemesisTrophy ?? null).toBeNull();
    expect(a.nemesisTrophies ?? undefined).toBeUndefined();  // field never added in a solo run
    expect(a.nemesisLadderTier ?? undefined).toBeUndefined();
    // Byte-identical run-to-run (the ladder introduced no new side channel here).
    expect(norm(run())).toEqual(norm(a));
  });
});
