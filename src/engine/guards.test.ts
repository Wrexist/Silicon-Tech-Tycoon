// Correctness-guard tests: non-finite money is neutralised, hype/launchScore stays bounded
// when many hype sources stack, the sales curve gives a nonzero floor for a low-but-positive
// launch score, and priceFit/overallScore stay in bounds for extreme inputs. All deterministic.
import { describe, it, expect } from "vitest";
import { add, sub, scale, dollars, cents, ZERO } from "./money.ts";
import { scoreLaunch, priceFit } from "./market.ts";
import { overallScore } from "./product.ts";
import { forecast } from "./salesCurve.ts";
import { BALANCE } from "./balance.ts";
import type { ConsumerTrends, Stats } from "./types.ts";

const EVEN: Stats = { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 };
const TRENDS: ConsumerTrends = { weights: EVEN, targetWeights: EVEN };
const MID: Stats = { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 };
const ZEROS: Stats = { performance: 0, quality: 0, battery: 0, design: 0, ecosystem: 0 };

describe("money finite-guard", () => {
  it("never returns NaN from add/sub/scale when an operand is non-finite", () => {
    const nan = NaN as ReturnType<typeof cents>;
    const inf = Infinity as ReturnType<typeof cents>;
    expect(Number.isFinite(add(nan, cents(100)))).toBe(true);
    expect(add(nan, cents(100))).toBe(ZERO);
    expect(sub(cents(100), nan)).toBe(ZERO);
    expect(scale(inf, 2)).toBe(ZERO);
    expect(scale(cents(100), NaN)).toBe(ZERO);
    expect(Number.isFinite(scale(cents(100), Infinity))).toBe(true);
  });

  it("dollars/cents neutralise non-finite inputs", () => {
    expect(dollars(NaN)).toBe(ZERO);
    expect(cents(Infinity)).toBe(ZERO);
    expect(dollars(5)).toBe(500); // still correct for finite values
  });

  it("a NaN can never poison a running cash total", () => {
    let cash = dollars(1000);
    cash = add(cash, NaN as ReturnType<typeof cents>);
    cash = add(cash, dollars(50));
    expect(Number.isFinite(cash)).toBe(true);
  });
});

describe("hype / launchScore stays bounded", () => {
  function score(hypeBonus: number) {
    return scoreLaunch({
      stats: MID,
      category: "phone",
      price: dollars(800),
      trends: TRENDS,
      reputation: 100,
      marketerSkill: 10,
      competitorStrength: 0,
      hypeBonus,
    });
  }

  it("clamps hype no matter how many hype sources stack", () => {
    const huge = score(1_000_000);
    expect(huge.hype).toBeLessThanOrEqual(BALANCE.market.hype.max * 2);
    expect(Number.isFinite(huge.launchScore)).toBe(true);
  });

  it("stacking hype cannot make launchScore explode past the clamped ceiling", () => {
    // Both bonuses already push hype past the ceiling, so the resulting scores are identical
    // — proving extra stacked hype buys nothing once the clamp is hit (no runaway volume).
    const ceiling = BALANCE.market.hype.max * 2;
    const a = score(50);
    const b = score(50_000);
    expect(a.hype).toBe(ceiling);
    expect(b.hype).toBe(ceiling);
    expect(b.launchScore).toBe(a.launchScore);
  });
});

describe("salesCurve floor", () => {
  it("a low-but-positive launchScore still sells a nonzero floor", () => {
    const f = forecast(0.5, 1);
    expect(f.totalUnits).toBeGreaterThan(0);
  });

  it("a zero launchScore sells nothing", () => {
    expect(forecast(0, 1).totalUnits).toBe(0);
  });

  it("weekly units sum to the total for a low-positive score", () => {
    const f = forecast(0.5, 1);
    const summed = f.weeklyUnits.reduce((a, b) => a + b, 0);
    expect(summed).toBe(f.totalUnits);
  });
});

describe("priceFit / overallScore stay in bounds for extreme inputs", () => {
  it("priceFit stays within [minFit, maxFit] at price 0, huge price, and all-zero stats", () => {
    const p = BALANCE.market.price;
    const cases = [
      priceFit(cents(0), MID, "phone"),
      priceFit(dollars(50_000_000), MID, "phone"),
      priceFit(cents(0), ZEROS, "phone"),
      priceFit(dollars(50_000_000), ZEROS, "phone"),
    ];
    for (const fit of cases) {
      expect(Number.isFinite(fit)).toBe(true);
      expect(fit).toBeGreaterThanOrEqual(p.minFit);
      expect(fit).toBeLessThanOrEqual(p.maxFit);
    }
  });

  it("overallScore stays within [0, statMax] for all-zero and maxed stats", () => {
    const zero = overallScore(ZEROS, "phone");
    const maxed = overallScore(
      { performance: 100, quality: 100, battery: 100, design: 100, ecosystem: 100 },
      "phone",
    );
    expect(zero).toBe(0);
    expect(maxed).toBeGreaterThanOrEqual(0);
    expect(maxed).toBeLessThanOrEqual(BALANCE.statMax);
  });

  it("scoreLaunch is finite and non-negative for extreme inputs", () => {
    const bd = scoreLaunch({
      stats: ZEROS,
      category: "phone",
      price: cents(0),
      trends: TRENDS,
      reputation: 0,
      marketerSkill: 0,
      competitorStrength: 0,
    });
    expect(Number.isFinite(bd.launchScore)).toBe(true);
    expect(bd.launchScore).toBeGreaterThanOrEqual(0);
  });
});
