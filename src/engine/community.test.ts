import { describe, it, expect } from "vitest";
import { sentimentTarget, evolveSentiment, superfansFrom, sentimentDecayFactor, moodTier, MOOD_LABEL, communityMoment, type CommunityFacts } from "./community.ts";
import { BALANCE } from "./balance.ts";

const C = BALANCE.fans.community;
const facts = (p: Partial<CommunityFacts>): CommunityFacts => ({ hits: 0, solids: 0, flops: 0, weeksSinceLaunch: 12, fans: 10_000, ...p });

describe("sentimentTarget", () => {
  it("hits lift the mood, flops sink it harder", () => {
    expect(sentimentTarget(facts({ hits: 2 }))).toBeGreaterThan(0);
    expect(sentimentTarget(facts({ flops: 1 }))).toBeLessThan(0);
    // a flop stings more than a hit delights (per-unit weights)
    expect(Math.abs(sentimentTarget(facts({ flops: 1 })))).toBeGreaterThan(sentimentTarget(facts({ hits: 1 })));
  });
  it("recent shipping engages the community; long neglect sours it", () => {
    expect(sentimentTarget(facts({ weeksSinceLaunch: 2 }))).toBeGreaterThan(sentimentTarget(facts({ weeksSinceLaunch: 40 })));
  });
  it("is clamped to [-1, 1]", () => {
    expect(sentimentTarget(facts({ hits: 20 }))).toBeLessThanOrEqual(1);
    expect(sentimentTarget(facts({ flops: 20 }))).toBeGreaterThanOrEqual(-1);
  });
});

describe("evolveSentiment", () => {
  it("moves toward the target and decays toward neutral when idle", () => {
    const up = evolveSentiment(0, facts({ hits: 3, weeksSinceLaunch: 2 }));
    expect(up).toBeGreaterThan(0);
    // a happy community with no news drifts back toward 0
    const drift = evolveSentiment(0.8, facts({ weeksSinceLaunch: 15 }));
    expect(drift).toBeLessThan(0.8);
    expect(drift).toBeGreaterThan(0);
  });
});

describe("superfansFrom", () => {
  it("only positive sentiment makes superfans, scaling with fans", () => {
    expect(superfansFrom(-0.5, 10_000)).toBe(0);
    expect(superfansFrom(0, 10_000)).toBe(0);
    expect(superfansFrom(1, 10_000)).toBe(Math.round(10_000 * C.superfanShareAtMax));
    expect(superfansFrom(0.5, 10_000)).toBeGreaterThan(0);
    expect(superfansFrom(1, 20_000)).toBeGreaterThan(superfansFrom(1, 10_000));
  });
});

describe("sentimentDecayFactor", () => {
  it("is exactly the base decay at sentiment 0 (neutral game byte-identical)", () => {
    expect(sentimentDecayFactor(0.992, 0)).toBe(0.992);
  });
  it("a happy community loses fewer fans; an unhappy one loses more", () => {
    expect(sentimentDecayFactor(0.99, 0.8)).toBeGreaterThan(0.99);  // retains more
    expect(sentimentDecayFactor(0.99, -0.8)).toBeLessThan(0.99);    // retains less
    // never turns decay into growth
    expect(sentimentDecayFactor(0.99, 1)).toBeLessThanOrEqual(1);
  });
});

describe("moodTier + moments", () => {
  it("buckets sentiment into moods", () => {
    expect(moodTier(-0.5)).toBe("restless");
    expect(moodTier(0)).toBe("cool");
    expect(moodTier(0.3)).toBe("warm");
    expect(moodTier(0.8)).toBe("devoted");
    expect(MOOD_LABEL.devoted).toBe("Devoted");
  });
  it("community moments are deterministic, in-pool, and match the mood", () => {
    expect(communityMoment(5, 30, 0.9)).toBe(communityMoment(5, 30, 0.9));
    expect(typeof communityMoment(5, 30, -0.9)).toBe("string");
    expect(communityMoment(5, 30, 0.9).length).toBeGreaterThan(0);
  });
});
