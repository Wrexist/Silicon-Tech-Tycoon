import { describe, it, expect } from "vitest";
import { keynoteWindowWeeks, keynoteMaxBonus, keynotePressFlavour } from "./keynote.ts";
import { BALANCE } from "./balance.ts";

describe("keynote window math", () => {
  it("window = ceil(remaining build weeks) + grace, floored at 1 week of build", () => {
    const g = BALANCE.keynote.graceWeeks;
    expect(keynoteWindowWeeks(3)).toBe(3 + g);
    expect(keynoteWindowWeeks(2.1)).toBe(3 + g); // ceils the remaining weeks
    expect(keynoteWindowWeeks(0)).toBe(1 + g);   // floored — a near-done build still gets a real window
    expect(keynoteWindowWeeks(-5)).toBe(1 + g);
  });
});

describe("keynote max-bonus (decay) math", () => {
  it("scales up with lead (earlier announce = bigger max) at perLeadWeek over the base floor", () => {
    const k = BALANCE.keynote;
    expect(keynoteMaxBonus(1)).toBeCloseTo(k.baseHype + k.perLeadWeek * 1, 10);
    expect(keynoteMaxBonus(2)).toBeCloseTo(k.baseHype + k.perLeadWeek * 2, 10);
    expect(keynoteMaxBonus(2)).toBeGreaterThan(keynoteMaxBonus(1)); // monotonic in lead
  });

  it("is capped at maxHype so it can never out-stack mastery / mandates", () => {
    expect(keynoteMaxBonus(100)).toBe(BALANCE.keynote.maxHype);
    expect(keynoteMaxBonus(50)).toBeLessThanOrEqual(BALANCE.keynote.maxHype);
    // Guard rail: the ceiling stays within the ≤15% band the other hype seams use.
    expect(BALANCE.keynote.maxHype).toBeLessThanOrEqual(0.15);
  });
});

describe("keynote press flavour (derived-hash salt 293)", () => {
  it("is deterministic per (seed, week) and always an authored non-empty string", () => {
    for (const [seed, week] of [[1, 0], [42, 17], [9999, 130]] as const) {
      const a = keynotePressFlavour(seed, week);
      const b = keynotePressFlavour(seed, week);
      expect(a).toBe(b);
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(0);
    }
  });

  it("varies across weeks (not a constant)", () => {
    const lines = new Set(Array.from({ length: 40 }, (_, w) => keynotePressFlavour(7, w)));
    expect(lines.size).toBeGreaterThan(1);
  });
});
