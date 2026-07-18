import { describe, it, expect } from "vitest";
import {
  duelTargetMargin,
  startDuel,
  duelProgress,
  duelMet,
  nextLadderTier,
  duelReward,
  duelVictoryLine,
} from "./nemesisDuel.ts";
import { BALANCE } from "./balance.ts";

const D = BALANCE.competitors.nemesis.duel;

describe("duelTargetMargin — tier + ascension scaling", () => {
  it("tier 0 at no ascension is the base margin", () => {
    expect(duelTargetMargin(0, 0)).toBeCloseTo(D.baseMargin, 6);
  });
  it("each ladder tier widens the required lead", () => {
    expect(duelTargetMargin(1, 0)).toBeCloseTo(D.baseMargin + D.marginPerTier, 6);
    expect(duelTargetMargin(3, 0)).toBeCloseTo(D.baseMargin + 3 * D.marginPerTier, 6);
    // monotonic in tier
    expect(duelTargetMargin(2, 0)).toBeGreaterThan(duelTargetMargin(1, 0));
  });
  it("ascension level widens it further so it stays meaningful at high Heat", () => {
    expect(duelTargetMargin(0, 4)).toBeCloseTo(D.baseMargin + 4 * D.marginPerAscension, 6);
    expect(duelTargetMargin(0, 5)).toBeGreaterThan(duelTargetMargin(0, 0));
    // tier + ascension compound
    expect(duelTargetMargin(2, 3)).toBeCloseTo(D.baseMargin + 2 * D.marginPerTier + 3 * D.marginPerAscension, 6);
  });
  it("clamps negative tier/ascension to zero (never eases below base)", () => {
    expect(duelTargetMargin(-5, -5)).toBeCloseTo(D.baseMargin, 6);
  });
});

describe("startDuel", () => {
  it("arms a window of the configured length, snapshotting the margin", () => {
    const d = startDuel("pomelo", 40, 2, 1);
    expect(d.rivalId).toBe("pomelo");
    expect(d.startWeek).toBe(40);
    expect(d.endWeek).toBe(40 + D.windowWeeks);
    expect(d.tier).toBe(2);
    expect(d.targetMargin).toBeCloseTo(duelTargetMargin(2, 1), 6);
  });
});

describe("duelProgress + duelMet", () => {
  it("progress is playerValue over the margin-scaled target, clamped to [0,1]", () => {
    // margin 1.0 → target === rivalValue
    expect(duelProgress(50, 100, 1)).toBeCloseTo(0.5, 6);
    expect(duelProgress(100, 100, 1)).toBe(1);
    expect(duelProgress(250, 100, 1)).toBe(1); // clamped
    // a wider margin needs more to fill the bar
    expect(duelProgress(100, 100, 1.25)).toBeCloseTo(0.8, 6);
  });
  it("a vanished rival (0 value) reads as already met", () => {
    expect(duelProgress(0, 0, 1.2)).toBe(1);
    expect(duelMet(0, 0, 1.2)).toBe(true);
  });
  it("duelMet is true exactly when the player clears the margin", () => {
    expect(duelMet(105, 100, 1.05)).toBe(true);
    expect(duelMet(104, 100, 1.05)).toBe(false);
    expect(duelMet(100, 100, 1)).toBe(true);
  });
});

describe("nextLadderTier — escalation with a cap", () => {
  it("climbs one rung per win", () => {
    expect(nextLadderTier(0)).toBe(1);
    expect(nextLadderTier(3)).toBe(4);
  });
  it("never exceeds the cap (so it can't become background noise)", () => {
    expect(nextLadderTier(D.tierCap)).toBe(D.tierCap);
    expect(nextLadderTier(D.tierCap + 5)).toBe(D.tierCap);
  });
});

describe("duelReward — modest, tier-scaled, legacy post-IPO only", () => {
  it("pays base rep + fans at tier 0, no legacy pre-IPO", () => {
    const r = duelReward(0, false);
    expect(r.rep).toBe(D.reward.baseRep);
    expect(r.fans).toBe(D.reward.baseFans);
    expect(r.legacyPoints).toBe(0);
  });
  it("grows slightly per rung and grants a legacy point once public", () => {
    const r = duelReward(2, true);
    expect(r.rep).toBe(D.reward.baseRep + 2 * D.reward.repPerTier);
    expect(r.fans).toBe(D.reward.baseFans + 2 * D.reward.fansPerTier);
    expect(r.legacyPoints).toBe(D.reward.legacyPointsPostIpo);
  });
  it("stays modest — a single duel's rep is a small nudge, not game-breaking", () => {
    expect(duelReward(0, false).rep).toBeLessThanOrEqual(5);
  });
});

describe("duelVictoryLine — derived-hash (salt 277), never the sim RNG", () => {
  it("is deterministic for the same (seed, week) and in-pool", () => {
    expect(duelVictoryLine(7, 20)).toBe(duelVictoryLine(7, 20));
    const line = duelVictoryLine(7, 20);
    expect(typeof line).toBe("string");
    expect(line.length).toBeGreaterThan(0);
    expect(line).toContain("{rival}"); // the state layer name-fills it
  });
  it("varies across weeks (a real stream, not a constant)", () => {
    const lines = new Set(Array.from({ length: 12 }, (_, w) => duelVictoryLine(7, w)));
    expect(lines.size).toBeGreaterThan(1);
  });
});
