import { describe, it, expect } from "vitest";
import { eurekaDue, generateEureka, resolveEurekaChase, insightProgress } from "./eureka.ts";
import { BALANCE } from "./balance.ts";

const E = BALANCE.research.eureka;

describe("eurekaDue", () => {
  it("is deterministic and fires at roughly the configured cadence over a long horizon", () => {
    expect(eurekaDue(42, 100)).toBe(eurekaDue(42, 100));
    let hits = 0;
    for (let w = 0; w < 4000; w++) if (eurekaDue(7, w)) hits++;
    const rate = hits / 4000;
    // ≈ 1/cadence, allow a generous band (hash isn't a perfect uniform, but must be in the ballpark).
    expect(rate).toBeGreaterThan(0.5 / E.cadenceWeeks);
    expect(rate).toBeLessThan(2 / E.cadenceWeeks);
  });
});

describe("generateEureka", () => {
  it("scales the bank windfall with era; jackpot > bank > fizzle", () => {
    const e2 = generateEureka(1, 10, 2);
    const e4 = generateEureka(1, 10, 4);
    expect(e4.bankRp).toBeGreaterThan(e2.bankRp);
    expect(e2.jackpotRp).toBeGreaterThan(e2.bankRp);
    expect(e2.bankRp).toBeGreaterThan(e2.fizzleRp);
    expect(["chip", "display", "battery", "materials", "software", "camera"]).toContain(e2.componentKind);
    expect(e2.jackpotChance).toBe(E.jackpotChance);
  });
});

describe("resolveEurekaChase", () => {
  it("is deterministic and returns exactly the jackpot or fizzle payoff", () => {
    const m = generateEureka(3, 40, 3);
    const a = resolveEurekaChase(3, m);
    const b = resolveEurekaChase(3, m);
    expect(a).toEqual(b); // deterministic for a given (seed, moment)
    expect(a.rp).toBe(a.jackpot ? m.jackpotRp : m.fizzleRp);
  });
  it("across many seeds, both outcomes occur (it's a real gamble)", () => {
    const outcomes = new Set<boolean>();
    for (let s = 0; s < 60; s++) outcomes.add(resolveEurekaChase(s, generateEureka(s, 20, 3)).jackpot);
    expect(outcomes.has(true)).toBe(true);
    expect(outcomes.has(false)).toBe(true);
  });
});

describe("insightProgress", () => {
  it("starts empty, fills over the cadence, caps below full, and resets on a breakthrough", () => {
    expect(insightProgress(0, 0)).toBe(0);
    expect(insightProgress(E.cadenceWeeks * 5, 0)).toBe(0.95); // capped, never a stuck 100%
    expect(insightProgress(30, 20)).toBeGreaterThan(0);       // 10 weeks since last → partial
    // the never-happened sentinel (large negative) floors to a fresh, empty meter — not full.
    expect(insightProgress(0, -999)).toBe(0);
  });
});
