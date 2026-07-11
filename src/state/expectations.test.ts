// Dynamic launch expectations (Track D — the anti-"every device is a hit" system): a hit must beat
// the company's own rolling track record, so a mature studio can't farm hits by re-shipping the same
// maxed spec. The static era bars still anchor a young company (and the pinned sim's opener).
import { describe, expect, it } from "vitest";
import { newGame, launchBars, verdictFor, nextLaunchExpectation, verdictBands } from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";

const x = BALANCE.reputation.expectation;

describe("launch expectations — the rising bar", () => {
  it("a brand-new company uses the plain static era bars (early launches unchanged)", () => {
    const s = { ...newGame(1), launchExpectation: 0 };
    const base = verdictBands(s.era);
    const bars = launchBars(s);
    expect(bars.hit).toBe(base.hit);
    expect(bars.solid).toBe(base.solid);
    expect(bars.flop).toBe(base.flop);
  });

  it("the bar rises with the rolling expectation, so the SAME score slides from hit to solid", () => {
    const era = 1;
    const base = verdictBands(era);
    // A score comfortably above the static hit bar.
    const score = base.hit * 3;
    // First launch (no track record) → a clear hit.
    const fresh = { ...newGame(2), era, launchExpectation: 0 };
    expect(verdictFor(fresh, score)).toBe("hit");
    // Once the company has been shipping at ~that level, the bar has risen above it → only solid.
    const proven = { ...newGame(2), era, launchExpectation: score };
    expect(launchBars(proven).hit).toBeGreaterThan(score); // must now TOP your record to hit
    expect(verdictFor(proven, score)).toBe("solid");
    // A genuinely BETTER launch (beats the record by the hit margin) is a hit again.
    expect(verdictFor(proven, score * x.hitMargin + 1)).toBe("hit");
  });

  it("launchBars is monotonic in the expectation baseline", () => {
    const mk = (exp: number) => launchBars({ ...newGame(3), era: 2, launchExpectation: exp });
    expect(mk(500).hit).toBeGreaterThan(mk(100).hit);
    expect(mk(500).solid).toBeGreaterThan(mk(0).solid);
  });

  it("nextLaunchExpectation is an EMA that tracks recent scores (and never goes negative)", () => {
    // No history → seed gently from the first score (× alpha), so the SECOND launch isn't
    // instantly locked out of a hit; then blend toward each new one.
    const first = nextLaunchExpectation(0, 300);
    expect(first).toBe(Math.round(300 * x.alpha));
    const second = nextLaunchExpectation(300, 500);
    expect(second).toBeGreaterThan(300);
    expect(second).toBeLessThan(500); // partial move (EMA), not a jump
    expect(second).toBe(Math.round(300 * (1 - x.alpha) + 500 * x.alpha));
    expect(nextLaunchExpectation(200, 0)).toBeGreaterThanOrEqual(0);
  });

  it("a disappointing product flops relative to a high track record (high expectations bite)", () => {
    const era = 3;
    const proven = { ...newGame(4), era, launchExpectation: verdictBands(era).hit * 4 };
    const bars = launchBars(proven);
    expect(verdictFor(proven, bars.flop - 1)).toBe("flop"); // well below your standard → a flop
    expect(bars.flop).toBeGreaterThan(verdictBands(era).flop); // the flop bar rose with expectations
  });
});
