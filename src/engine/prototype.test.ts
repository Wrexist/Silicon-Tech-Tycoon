import { describe, expect, it } from "vitest";
import { PROTOTYPE_SALT, prototypeOutcome } from "./prototype.ts";

const args = { era: 2, weakestStat: "battery" as const, rp: 40 };

// Deterministic per (seed, week): the SAME run must resolve the same way every time, and two
// different weeks must be free to differ. Never the main sim RNG.
describe("prototypeOutcome", () => {
  it("is stable for a given seed and week", () => {
    expect(prototypeOutcome(4242, 30, args)).toEqual(prototypeOutcome(4242, 30, args));
  });

  it("varies across weeks so the gamble is real", () => {
    const seen = new Set([20, 21, 22, 23, 24, 25, 26, 27].map((w) => JSON.stringify(prototypeOutcome(4242, w, args))));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("only ever names the draft's weakest stat as the flaw, or none", () => {
    for (let w = 0; w < 40; w++) {
      const out = prototypeOutcome(99, w, args);
      if (out.flaw !== null) expect(out.flaw).toBe("battery");
      expect(out.confidenceGain).toBeGreaterThanOrEqual(0);
    }
  });

  it("reserves the wave's salt and does not alias an in-use one", () => {
    expect(PROTOTYPE_SALT).toBe(317);
  });
});
