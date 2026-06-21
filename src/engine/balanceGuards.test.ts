// Balance-guard harness (EXECUTION_PLAN Phase 1b — "late-game determinism check").
//
// These tests do NOT change balance; they PIN the two design guarantees that keep the game from
// collapsing into the genre's #1 failure mode (Game Dev Tycoon's "solved endgame" — once the
// optimal recipe is known, replays become pointless). Both guards are tuning mandates in
// CLAUDE.md / RETENTION_ROADMAP §0; this harness makes them CI-enforced so a future balance.ts
// tweak can't silently break them.
//
// GUARD A — No universal recipe. As consumer trends drift, the revenue-optimal product profile
//           must genuinely change. A single profile that wins regardless of trends = a solved game.
// GUARD B — Gouging fails (elastic demand). For a fixed product, revenue (units × price) must peak
//           NEAR the fair price, not at the maximum price — i.e. "max price always sells" is false.
// GUARD C — Power still matters. At matched (fair) pricing under balanced trends, a clearly stronger
//           product out-earns a clearly weaker one (bets on quality aren't pointless).
//
// All pure-engine, seed-deterministic, zero device dependency.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { type Stats, type StatKey, STAT_KEYS } from "./types.ts";
import {
  initialTrends,
  randomTrendTarget,
  advanceTrends,
  scoreLaunch,
  priceGuidance,
} from "./market.ts";
import { forecast } from "./salesCurve.ts";
import { makeRng } from "./rng.ts";
import type { CategoryId } from "./types.ts";

const CATEGORY: CategoryId = "phone";
const MARKET_SIZE = 1.0;
const REPUTATION = 45;
const MARKETER = 45;

/** A recipe is a finished stat profile (what a built device's computeStats would yield) priced at
 *  its own fair price, so the contest below is purely about trend-fit, not who priced smarter. */
function recipe(primary: StatKey, hi = 88, base = 56): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = base;
  s[primary] = hi;
  return s;
}

const RECIPES: Record<string, Stats> = {
  performance: recipe("performance"),
  quality: recipe("quality"),
  battery: recipe("battery"),
  design: recipe("design"),
  ecosystem: recipe("ecosystem"),
};

/** Revenue proxy at a given price under given trends: realized units × price. */
function revenueAt(stats: Stats, priceDollars: number, trends: ReturnType<typeof initialTrends>): number {
  const price = dollars(Math.round(priceDollars));
  const b = scoreLaunch({
    stats,
    category: CATEGORY,
    price,
    trends,
    reputation: REPUTATION,
    marketerSkill: MARKETER,
    competitorStrength: 0,
  });
  const units = forecast(b.launchScore, MARKET_SIZE, b.priceFit).totalUnits;
  return units * priceDollars;
}

/** Revenue with each recipe priced at its OWN fair price (margin-neutral comparison). */
function revenueAtFair(stats: Stats, trends: ReturnType<typeof initialTrends>): number {
  const fair = toDollars(priceGuidance(stats, CATEGORY).fair);
  return revenueAt(stats, fair, trends);
}

/** Sample N independent-ish trend states by repeatedly retargeting the drift from one seed. */
function sampleTrends(seed: number, n: number) {
  const rng = makeRng(seed);
  let t = initialTrends(rng);
  const out: ReturnType<typeof initialTrends>[] = [];
  for (let i = 0; i < n; i++) {
    // Several drift steps toward a fresh random target → a meaningfully different demand climate.
    for (let s = 0; s < 4; s++) t = advanceTrends(t, randomTrendTarget(rng));
    out.push(t);
  }
  return out;
}

describe("GUARD A — no universal recipe (trends reshuffle the optimum)", () => {
  it("no single profile wins more than 70% of trend climates", () => {
    const samples = sampleTrends(1234, 240);
    const wins: Record<string, number> = {};
    for (const k of Object.keys(RECIPES)) wins[k] = 0;

    for (const trends of samples) {
      let best = "";
      let bestRev = -1;
      for (const [name, stats] of Object.entries(RECIPES)) {
        const rev = revenueAtFair(stats, trends);
        if (rev > bestRev) {
          bestRev = rev;
          best = name;
        }
      }
      wins[best]++;
    }

    const topShare = Math.max(...Object.values(wins)) / samples.length;
    // If one recipe owned the market regardless of trends, the game would be "solved".
    expect(topShare).toBeLessThan(0.7);
    // And the field must not collapse to a single winner — at least 3 of the 5 profiles win sometime.
    const everWon = Object.values(wins).filter((w) => w > 0).length;
    expect(everWon).toBeGreaterThanOrEqual(3);
  });

  it("is seed-stable (the guard isn't an artifact of one lucky seed)", () => {
    for (const seed of [7, 99, 4242]) {
      const samples = sampleTrends(seed, 160);
      const wins: Record<string, number> = {};
      for (const k of Object.keys(RECIPES)) wins[k] = 0;
      for (const trends of samples) {
        let best = "";
        let bestRev = -1;
        for (const [name, stats] of Object.entries(RECIPES)) {
          const rev = revenueAtFair(stats, trends);
          if (rev > bestRev) {
            bestRev = rev;
            best = name;
          }
        }
        wins[best]++;
      }
      const topShare = Math.max(...Object.values(wins)) / samples.length;
      expect(topShare).toBeLessThan(0.75);
    }
  });
});

describe("GUARD B — gouging fails (revenue peaks near fair, not at max price)", () => {
  it("revenue as a function of price is single-peaked below 2× fair", () => {
    const rng = makeRng(555);
    let trends = initialTrends(rng);
    for (let s = 0; s < 6; s++) trends = advanceTrends(trends, randomTrendTarget(rng));

    const stats = recipe("quality");
    const fair = toDollars(priceGuidance(stats, CATEGORY).fair);

    let bestPrice = 0;
    let bestRev = -1;
    // Sweep 0.4× … 3.0× fair.
    for (let mult = 0.4; mult <= 3.0001; mult += 0.05) {
      const rev = revenueAt(stats, fair * mult, trends);
      if (rev > bestRev) {
        bestRev = rev;
        bestPrice = fair * mult;
      }
    }
    // The revenue-maximizing price must sit in a sane band around fair — never the top of the sweep.
    expect(bestPrice).toBeLessThan(fair * 2);
    expect(bestPrice).toBeGreaterThan(fair * 0.6);

    // And tripling the fair price must destroy revenue vs the fair price (demand is elastic).
    const revFair = revenueAt(stats, fair, trends);
    const revGouge = revenueAt(stats, fair * 3, trends);
    expect(revGouge).toBeLessThan(revFair * 0.5);
  });
});

describe("GUARD C — power still matters (strong out-earns weak at fair pricing)", () => {
  it("a high-overall product out-earns a low-overall one under balanced trends", () => {
    const rng = makeRng(8080);
    const trends = initialTrends(rng); // near-balanced initial weights

    const strong = {} as Stats;
    const weak = {} as Stats;
    for (const k of STAT_KEYS) {
      strong[k] = 82;
      weak[k] = 38;
    }
    expect(revenueAtFair(strong, trends)).toBeGreaterThan(revenueAtFair(weak, trends));
  });
});
