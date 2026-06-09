// B6 — rival share prices must be mean-reverting, NOT a passive income printer.
// Holding stock should earn ~the dividend yield; price appreciation must be ~zero-EV long-run.
import { describe, expect, it } from "vitest";
import { advanceCompetitors, fairSharePrice, initCompetitors, rivalDef } from "./competitors.ts";
import { makeRng } from "./rng.ts";
import type { CompetitorState } from "./types.ts";

/** Run the weekly competitor sim for `weeks`, returning the final states. */
function simulate(comps: CompetitorState[], weeks: number, rng: ReturnType<typeof makeRng>): CompetitorState[] {
  let cur = comps;
  for (let w = 1; w <= weeks; w++) {
    cur = advanceCompetitors(cur, w, 1, rng).competitors;
  }
  return cur;
}

describe("rival share prices (B6 — mean reversion, no income printer)", () => {
  it("fair value sits at the calibrated price and follows reputation, not time", () => {
    const rng = makeRng(7);
    for (const c of initCompetitors(rng)) {
      const base = (rivalDef(c.id)?.share ?? 50) * 100;
      // init jitters reputation ±4 → fair stays within a few % of the calibrated price
      expect(fairSharePrice(c)).toBeGreaterThan(base * 0.9);
      expect(fairSharePrice(c)).toBeLessThan(base * 1.1);
      // a reputation surge lifts fair value; a collapse drops it
      expect(fairSharePrice({ ...c, reputation: c.reputation + 20 })).toBeGreaterThan(fairSharePrice(c));
      expect(fairSharePrice({ ...c, reputation: c.reputation - 20 })).toBeLessThan(fairSharePrice(c));
    }
  });

  it("long-run buy-and-hold price appreciation is ~zero-EV (the old printer compounded ≥+0.4%/wk)", () => {
    const weeks = 400;
    for (const seed of [1, 42, 1337]) {
      const rng = makeRng(seed);
      const start = initCompetitors(rng);
      const end = simulate(start, weeks, rng);
      // average weekly log-return across the whole market stays a rounding error
      let acc = 0;
      for (let i = 0; i < end.length; i++) acc += Math.log(end[i].sharePrice / start[i].sharePrice);
      const meanWeeklyLogReturn = acc / end.length / weeks;
      expect(Math.abs(meanWeeklyLogReturn)).toBeLessThan(0.002); // < ~±11%/yr; old drift+momentum+pops ≈ +40-70%/yr
      // and no single rival wanders far from its fundamental level
      for (const c of end) {
        const fair = fairSharePrice(c);
        expect(c.sharePrice).toBeGreaterThan(fair / 3);
        expect(c.sharePrice).toBeLessThan(fair * 3);
      }
    }
  });

  it("an overpriced rival deflates back toward fair value", () => {
    const rng = makeRng(9);
    const comps = initCompetitors(rng).map((c) => ({ ...c, sharePrice: fairSharePrice(c) * 3 }));
    const end = simulate(comps, 80, rng);
    for (let i = 0; i < end.length; i++) {
      expect(end[i].sharePrice).toBeLessThan(comps[i].sharePrice);
      expect(end[i].sharePrice).toBeLessThan(fairSharePrice(end[i]) * 1.8);
    }
  });

  it("a crashed rival recovers toward fair value", () => {
    const rng = makeRng(11);
    const comps = initCompetitors(rng).map((c) => ({ ...c, sharePrice: Math.max(50, Math.round(fairSharePrice(c) / 3)) }));
    const end = simulate(comps, 80, rng);
    for (let i = 0; i < end.length; i++) {
      expect(end[i].sharePrice).toBeGreaterThan(comps[i].sharePrice);
      expect(end[i].sharePrice).toBeGreaterThan(fairSharePrice(end[i]) * 0.55);
    }
  });

  it("a corrupt persisted price heals instead of poisoning the sim", () => {
    const rng = makeRng(13);
    const comps = initCompetitors(rng).map((c, i) => ({ ...c, sharePrice: i === 0 ? Number.NaN : -500 }));
    const end = simulate(comps, 4, rng);
    for (const c of end) {
      expect(Number.isFinite(c.sharePrice)).toBe(true);
      expect(c.sharePrice).toBeGreaterThanOrEqual(50);
    }
  });
});
