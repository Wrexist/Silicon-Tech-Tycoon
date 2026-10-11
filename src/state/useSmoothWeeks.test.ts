import { describe, expect, it } from "vitest";
import { SMOOTH_CAP, progressPct, smoothSub, smoothedValue } from "./useSmoothWeeks.ts";

describe("smooth weekly progress (research + build rings)", () => {
  it("follows the sim clock's phase, capped short of the next tick", () => {
    expect([0, 0.125, 0.5, 0.75].map(smoothSub)).toEqual([0, 0.125, 0.5, 0.75]);
    expect(smoothSub(1)).toBe(SMOOTH_CAP);
    expect(SMOOTH_CAP).toBeLessThan(1);
  });

  it("is safe on bad inputs (no NaN, no negative, never past the cap)", () => {
    expect(smoothSub(-1)).toBe(0);
    expect(smoothSub(Number.NaN)).toBe(0);
    expect(smoothSub(5)).toBe(SMOOTH_CAP);
  });

  it("scales the step by the next tick's real rate and never reaches the total early", () => {
    // 2-week research, week 1 committed, halfway through the week: 75% of the way, not stuck at 50%
    expect(smoothedValue(1, 0.5, 1, 2) / 2).toBe(0.75);
    // a crunching lab adds 1.5 progress-weeks per tick, and the estimate follows that rate
    expect(smoothedValue(1, 0.5, 1.5, 6)).toBe(1.75);
    expect(smoothedValue(1, 1, 1, 2)).toBeLessThan(2);
    expect(smoothedValue(1.9, 0.97, 1.5, 2)).toBeLessThan(2); // a crunch that will finish next tick
    expect(smoothedValue(2, 0.5, 1, 2)).toBe(2);
    expect(smoothedValue(1, 0.5, -1, 2)).toBe(1);
  });

  it("the % reads 100 only when the job is really done (the cap must not round up to 100)", () => {
    // every just-before-the-tick value the review measured rounding to 100
    for (const [committed, perWeek, total] of [[5, 1, 6], [5.5, 1.5, 6], [3.5, 1.5, 4], [1, 1, 2], [7, 1, 8]] as const) {
      const v = smoothedValue(committed, 1, perWeek, total);
      expect(progressPct(v, total), `${committed}/${total}`).toBeLessThanOrEqual(99);
    }
    expect(progressPct(2, 2)).toBe(100);
    expect(progressPct(0, 6)).toBe(0);
    expect(progressPct(3, 6)).toBe(50);
    expect(progressPct(1, 0)).toBe(0); // nothing to show
    expect(progressPct(1.4, 5)).toBe(28); // float error must not floor a percent low
    expect(progressPct(2.8, 5)).toBe(56);
  });
});
