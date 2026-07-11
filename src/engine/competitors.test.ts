// B6 — rival share prices must be mean-reverting, NOT a passive income printer.
// Holding stock should earn ~the dividend yield; price appreciation must be ~zero-EV long-run.
import { describe, expect, it } from "vitest";
import { advanceCompetitors, fairSharePrice, initCompetitors, rivalDef, rivalDoctrine } from "./competitors.ts";
import { makeRng } from "./rng.ts";
import { BALANCE } from "./balance.ts";
import type { CategoryId, CompetitorState } from "./types.ts";

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

/** A fresh single-rival state primed to launch on week 1. */
function primed(id: string): CompetitorState {
  const def = rivalDef(id)!;
  return { id, name: def.name, blurb: def.blurb, reputation: def.reputation, strengthByCategory: {}, nextLaunchWeek: 1, sharePrice: def.share * 100, priceHistory: [def.share] };
}

/** Collect one rival's first launch across many seeds (era 4 → every category available). */
function launchesOver(id: string, hot: CategoryId[], seeds: number) {
  const out: { category: CategoryId; strength: number; contested?: boolean }[] = [];
  for (let seed = 0; seed < seeds; seed++) {
    const { launches } = advanceCompetitors([primed(id)], 1, 4, makeRng(seed), hot);
    if (launches.length) out.push(launches[0]);
  }
  return out;
}

describe("B2 — rival doctrines (variety + presence, not raw difficulty)", () => {
  it("maps each rival to its doctrine, defaulting unknown ids to generalist", () => {
    expect(rivalDoctrine("pomelo")).toBe("defender");
    expect(rivalDoctrine("pandacore")).toBe("undercutter");
    expect(rivalDoctrine("novaplus")).toBe("undercutter");
    expect(rivalDoctrine("googol")).toBe("trendChaser");
    expect(rivalDoctrine("tristar")).toBe("generalist");
    expect(rivalDoctrine("nobody")).toBe("generalist");
  });

  it("a trend-chaser piles into the player's hot category more than when it's cold", () => {
    // phone is NOT one of Oqular's preferred categories, so any extra phone launches are the doctrine.
    const cold = launchesOver("googol", [], 600).filter((l) => l.category === "phone").length;
    const hot = launchesOver("googol", ["phone"], 600).filter((l) => l.category === "phone").length;
    expect(hot).toBeGreaterThan(cold);
  });

  it("a defender brings extra strength into a contested category (capped, still winnable)", () => {
    const mean = (arr: { strength: number }[]) => arr.reduce((a, b) => a + b.strength, 0) / Math.max(1, arr.length);
    const cold = launchesOver("pomelo", [], 800).filter((l) => l.category === "desktop");
    const hot = launchesOver("pomelo", ["desktop"], 800).filter((l) => l.category === "desktop");
    expect(mean(hot)).toBeGreaterThan(mean(cold));
  });

  it("only an undercutter flags a launch as contested, and only in the hot category", () => {
    const panda = launchesOver("pandacore", ["phone"], 500);
    expect(panda.some((l) => l.category === "phone" && l.contested)).toBe(true); // it does undercut
    expect(panda.every((l) => l.contested === true ? l.category === "phone" : true)).toBe(true); // only there
    // a defender / generalist never starts a price war
    expect(launchesOver("pomelo", ["phone"], 300).every((l) => !l.contested)).toBe(true);
    expect(launchesOver("tristar", ["phone"], 300).every((l) => !l.contested)).toBe(true);
  });

  it("no rival launch ever exceeds the era's strength ceiling, even under sustained player success", () => {
    const rng = makeRng(5);
    let comps = initCompetitors(rng);
    const allCats: CategoryId[] = ["phone", "tablet", "laptop", "desktop", "monitor", "console", "wearable", "experimental"];
    const era4Cap = BALANCE.competitors.reactMaxStrengthByEra[3];
    for (let w = 1; w <= 300; w++) {
      const { competitors, launches } = advanceCompetitors(comps, w, 4, rng, allCats);
      for (const l of launches) expect(l.strength).toBeLessThanOrEqual(era4Cap);
      comps = competitors;
    }
  });

  it("durable competition (P3): late eras lift the ceiling AND slow decay vs the early game", () => {
    const cap = BALANCE.competitors.reactMaxStrengthByEra;
    const dec = BALANCE.competitors.strengthDecayByEra;
    // Eras 1–2 untouched; late eras strictly tougher + stickier, monotonic.
    expect(cap[0]).toBe(95);
    expect(cap[1]).toBe(95);
    expect(cap[3]).toBeGreaterThan(cap[2]);
    expect(cap[2]).toBeGreaterThan(cap[1]);
    expect(dec[1]).toBe(dec[0]);
    expect(dec[3]).toBeGreaterThan(dec[2]); // slower decay = higher factor = stickier presence
    expect(dec[2]).toBeGreaterThan(dec[1]);
  });

  it("rivals can reach contesting strength (>early-game cap) in the AI era", () => {
    const rng = makeRng(9);
    let comps = initCompetitors(rng);
    let maxSeen = 0;
    for (let w = 1; w <= 300; w++) {
      // ["phone"] = the player's hot category, so reacting rivals press there.
      const { competitors, launches } = advanceCompetitors(comps, w, 4, rng, ["phone"]);
      for (const l of launches) maxSeen = Math.max(maxSeen, l.strength);
      comps = competitors;
    }
    // In Era 4 a reacting rival can now out-muscle the old flat-95 wall (proving late competition bites).
    expect(maxSeen).toBeGreaterThan(95);
  });
});

describe("rival-vs-rival dynamics (item 2.4)", () => {
  it("no seed → no clashes (byte-identical to before)", () => {
    const comps = initCompetitors(makeRng(3));
    // Run many weeks with and without a seed using the SAME sim rng draws; the no-seed path must
    // never emit a clash beat.
    let sawClash = false;
    let cur = comps;
    const rng = makeRng(3);
    for (let w = 1; w <= 200; w++) {
      const r = advanceCompetitors(cur, w, 2, rng); // no seed arg
      cur = r.competitors;
      if (r.arcBeats.some((b) => b.text.includes("price war") || b.text.includes("poached"))) sawClash = true;
    }
    expect(sawClash).toBe(false);
  });

  it("with a seed the field clashes on its own — beats fire and reputations move, deterministically", () => {
    const comps = initCompetitors(makeRng(5));
    const run = () => {
      let cur = comps;
      const beats: string[] = [];
      const rng = makeRng(5);
      for (let w = 1; w <= 200; w++) {
        const r = advanceCompetitors(cur, w, 2, rng, undefined, undefined, 424242);
        cur = r.competitors;
        for (const b of r.arcBeats) if (b.text.includes("price war") || b.text.includes("poached")) beats.push(`${b.week}:${b.text}`);
      }
      return beats;
    };
    const beats = run();
    expect(beats.length).toBeGreaterThan(0); // the world moved without the player
    expect(run()).toEqual(beats); // deterministic (derived hash, not the sim RNG)
  });
});
