// Word-of-mouth sales curves (item 1.1): the same lifetime total is redistributed by verdict —
// a hit ramps fast and sells for weeks (long tail + second wind); a flop spikes then collapses.
import { describe, expect, it } from "vitest";
import { distributeOverCurve, verdictCurveShape } from "./salesCurve.ts";
import { BALANCE } from "./balance.ts";

const TOTAL = 100_000;
const backHalf = (w: number[]) => w.slice(Math.floor(w.length / 2)).reduce((a, b) => a + b, 0);

describe("word-of-mouth sales curves", () => {
  it("every shape distributes EXACTLY the lifetime total (no units lost or invented)", () => {
    for (const v of ["hit", "solid", "steady", "flop"] as const) {
      const w = distributeOverCurve(TOTAL, verdictCurveShape(v));
      expect(w.reduce((a, b) => a + b, 0)).toBe(TOTAL);
      expect(w.length).toBe(BALANCE.sales.totalWeeks);
    }
  });

  it("'steady' reproduces the legacy curve byte-for-byte (ordinary launches unchanged)", () => {
    expect(distributeOverCurve(TOTAL, verdictCurveShape("steady"))).toEqual(distributeOverCurve(TOTAL));
  });

  it("a hit sells a bigger share in the back half than a flop (long tail vs collapse)", () => {
    const hit = distributeOverCurve(TOTAL, verdictCurveShape("hit"));
    const steady = distributeOverCurve(TOTAL, verdictCurveShape("steady"));
    const flop = distributeOverCurve(TOTAL, verdictCurveShape("flop"));
    expect(backHalf(hit)).toBeGreaterThan(backHalf(steady));
    expect(backHalf(steady)).toBeGreaterThan(backHalf(flop));
  });

  it("a hit's word-of-mouth sustains the late tail far better than a flop's collapse", () => {
    const lastQuarter = (w: number[]) => w.slice(Math.floor((w.length * 3) / 4)).reduce((a, b) => a + b, 0);
    const hit = distributeOverCurve(TOTAL, verdictCurveShape("hit"));
    const steady = distributeOverCurve(TOTAL, verdictCurveShape("steady"));
    const flop = distributeOverCurve(TOTAL, verdictCurveShape("flop"));
    // The final quarter carries a meaningfully larger share for a hit than steady, and steady than flop.
    expect(lastQuarter(hit)).toBeGreaterThan(lastQuarter(steady) * 1.3);
    expect(lastQuarter(steady)).toBeGreaterThan(lastQuarter(flop));
    // The hit's word-of-mouth flattens the decline: its late tail doesn't crater the way a flop's does.
    const flopMid = flop.slice(6, 10).reduce((a, b) => a + b, 0);
    const flopLate = flop.slice(12).reduce((a, b) => a + b, 0);
    expect(flopLate).toBeLessThan(flopMid * 0.4); // flop is clearly collapsing
  });
});
