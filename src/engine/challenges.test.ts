import { describe, it, expect } from "vitest";
import {
  MUTATORS,
  mutatorById,
  dailyChallenge,
  weeklyChallenge,
  dateKeyOf,
  mondayOf,
  hashSeed,
  formatScore,
  scoreMetricLabel,
  encodeChallengeCode,
  decodeChallengeCode,
} from "./challenges.ts";

describe("mutator catalog", () => {
  it("has unique ids and resolves them", () => {
    const ids = MUTATORS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MUTATORS) expect(mutatorById(m.id)).toBe(m);
    expect(mutatorById("nope")).toBeUndefined();
  });

  it("every mutator is well-formed and a positive cash multiplier where set", () => {
    for (const m of MUTATORS) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      if (m.cashMult != null) expect(m.cashMult).toBeGreaterThan(0);
      if (m.reputation != null) expect(m.reputation).toBeGreaterThanOrEqual(0);
      if (m.fans != null) expect(m.fans).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("date helpers", () => {
  it("dateKeyOf is UTC YYYY-MM-DD", () => {
    expect(dateKeyOf(new Date(Date.UTC(2026, 5, 19)))).toBe("2026-06-19");
    expect(dateKeyOf(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01-01");
  });

  it("mondayOf returns the Monday of the week (UTC), idempotent on a Monday", () => {
    // 2026-06-19 is a Friday → Monday is 2026-06-15.
    expect(mondayOf("2026-06-19")).toBe("2026-06-15");
    expect(mondayOf("2026-06-15")).toBe("2026-06-15"); // already Monday
    expect(mondayOf("2026-06-21")).toBe("2026-06-15"); // Sunday → same Monday
    expect(mondayOf("2026-06-22")).toBe("2026-06-22"); // next Monday
  });

  it("hashSeed is stable and unsigned", () => {
    expect(hashSeed("daily:2026-06-19")).toBe(hashSeed("daily:2026-06-19"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
    expect(hashSeed("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("dailyChallenge", () => {
  it("is deterministic — same date yields an identical challenge", () => {
    expect(dailyChallenge("2026-06-19")).toEqual(dailyChallenge("2026-06-19"));
  });

  it("varies across dates (different seed/mutator over a span)", () => {
    const days = ["2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23"];
    const seeds = new Set(days.map((d) => dailyChallenge(d).seed));
    expect(seeds.size).toBeGreaterThan(1); // not all identical
  });

  it("selects exactly one mutator and a sane score config", () => {
    const c = dailyChallenge("2026-06-19");
    expect(c.kind).toBe("daily");
    expect(c.dateKey).toBe("2026-06-19");
    expect(c.mutators).toHaveLength(1);
    expect(c.scoreWeek).toBe(52);
    expect(["netWorth", "cumulativeRevenue", "fans"]).toContain(c.scoreMetric);
  });
});

describe("weeklyChallenge", () => {
  it("is Monday-anchored — every day in a week yields the same challenge", () => {
    const mon = weeklyChallenge("2026-06-15");
    for (const d of ["2026-06-15", "2026-06-17", "2026-06-19", "2026-06-21"]) {
      expect(weeklyChallenge(d)).toEqual(mon);
    }
    expect(mon.dateKey).toBe("2026-06-15");
  });

  it("stacks 2–3 DISTINCT mutators and runs longer than daily", () => {
    for (const d of ["2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06"]) {
      const c = weeklyChallenge(d);
      expect(c.mutators.length).toBeGreaterThanOrEqual(2);
      expect(c.mutators.length).toBeLessThanOrEqual(3);
      const ids = c.mutators.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length); // distinct
      expect(c.scoreWeek).toBe(104);
    }
  });

  it("differs from the same date's daily challenge", () => {
    expect(weeklyChallenge("2026-06-19").seed).not.toBe(dailyChallenge("2026-06-19").seed);
  });
});

describe("shareable challenge codes", () => {
  it("round-trips a daily code", () => {
    const code = encodeChallengeCode("daily", "2026-06-19");
    expect(code).toBe("ST-D-20260619");
    expect(decodeChallengeCode(code)).toEqual({ kind: "daily", dateKey: "2026-06-19" });
  });

  it("normalizes a weekly code to its Monday (any day in the week resolves the same)", () => {
    // 2026-06-19 (Fri) → Monday 2026-06-15.
    expect(decodeChallengeCode(encodeChallengeCode("weekly", "2026-06-19"))).toEqual({ kind: "weekly", dateKey: "2026-06-15" });
    expect(decodeChallengeCode("ST-W-20260615")).toEqual({ kind: "weekly", dateKey: "2026-06-15" });
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(decodeChallengeCode("  st-d-20260101 ")).toEqual({ kind: "daily", dateKey: "2026-01-01" });
  });

  it("rejects garbage and impossible dates", () => {
    expect(decodeChallengeCode("nope")).toBe(null);
    expect(decodeChallengeCode("ST-X-20260101")).toBe(null);
    expect(decodeChallengeCode("ST-D-20261301")).toBe(null); // month 13
    expect(decodeChallengeCode("ST-D-2026")).toBe(null);
    expect(decodeChallengeCode("")).toBe(null);
  });
});

describe("score formatting", () => {
  it("formats money metrics as currency, fans compactly, others as integers", () => {
    expect(formatScore("netWorth", 1_500_000)).toMatch(/^\$/);
    expect(formatScore("cumulativeRevenue", 250_000)).toMatch(/^\$/);
    expect(formatScore("fans", 12_345)).toBe("12k");
    expect(formatScore("fans", 2_000_000)).toBe("2.0M");
    expect(formatScore("fans", 500)).toBe("500");
    expect(formatScore("reputation", 73.6)).toBe("74");
  });

  it("labels every metric", () => {
    expect(scoreMetricLabel("netWorth")).toBe("net worth");
    expect(scoreMetricLabel("fans")).toBe("fans");
  });
});
