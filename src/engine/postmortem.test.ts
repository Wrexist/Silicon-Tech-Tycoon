import { describe, it, expect } from "vitest";
import { postMortem, topFactorSummary, launchDrivers, launchTips, verdictOf, type FactorKey } from "./postmortem.ts";
import { dollars } from "./money.ts";
import type { LaunchInsight, LaunchedProduct } from "./types.ts";

function insight(p: Partial<LaunchInsight>): LaunchInsight {
  return {
    demandFit: 55,
    priceFit: 1,
    hype: 1.2,
    matchingRivals: 0,
    betterRivals: 0,
    competitionFactor: 1,
    ...p,
  };
}

describe("post-mortem ranking (Epic C1)", () => {
  it("pins price as the decisive factor for an overpriced flop", () => {
    const pm = postMortem(insight({ priceFit: 0.4, demandFit: 52 }), "flop");
    expect(pm.impacts.price.tone).toBe("negative");
    expect(pm.impacts.price.impact).toBeGreaterThan(0.5);
    expect(pm.dominant[0]).toBe("price");
    expect(pm.headline.toLowerCase()).toContain("flop");
    expect(pm.headline.toLowerCase()).toContain("price");
  });

  it("pins competition when rivals outclass the launch", () => {
    const pm = postMortem(insight({ betterRivals: 3, competitionFactor: 0.3 }), "steady");
    expect(pm.impacts.competition.tone).toBe("negative");
    expect(pm.dominant).toContain<FactorKey>("competition");
    expect(pm.headline.toLowerCase()).toContain("rivals");
  });

  it("leads a hit with its strongest positive driver", () => {
    const pm = postMortem(insight({ demandFit: 95, hype: 2.0, competitionFactor: 1 }), "hit");
    expect(pm.headline.startsWith("A hit")).toBe(true);
    // demand (impact ~0.9) or hype (impact ~0.85) should headline; both are positive
    expect(["demand", "hype"]).toContain(pm.dominant[0]);
  });

  it("uses the winning segment's name when audience is the standout", () => {
    const pm = postMortem(
      insight({
        demandFit: 52,
        perSegment: [
          { id: "pro", name: "Pro", captured: 0.9, fit: 90, priceFit: 1 },
          { id: "budget", name: "Budget", captured: 0.02, fit: 20, priceFit: 0.3 },
        ],
        dominantSegment: "pro",
        weakestSegment: "budget",
      }),
      "solid",
    );
    expect(pm.impacts.audience.impact).toBeGreaterThan(0.3);
    expect(pm.headline).toContain("Pro");
  });

  it("is pure / deterministic", () => {
    const a = postMortem(insight({ priceFit: 0.6 }), "flop");
    const b = postMortem(insight({ priceFit: 0.6 }), "flop");
    expect(a).toEqual(b);
  });

  it("ranks dominant factors most-decisive-first and respects the floor", () => {
    const pm = postMortem(insight({ demandFit: 50, priceFit: 1, hype: 1.15, competitionFactor: 1 }), "steady");
    // a perfectly neutral launch has no decisive factor
    expect(pm.dominant.length).toBe(0);
  });

  it("writes an authored narrative that reflects the verdict + the audience, em-dash-free (Track A)", () => {
    const pm = postMortem(
      insight({
        demandFit: 95, hype: 2.0, competitionFactor: 1,
        perSegment: [
          { id: "pro", name: "Pro", captured: 0.9, fit: 90, priceFit: 1 },
          { id: "budget", name: "Budget", captured: 0.05, fit: 20, priceFit: 0.3 },
        ],
        dominantSegment: "pro", weakestSegment: "budget",
      }),
      "hit",
    );
    expect(pm.narrative.length).toBeGreaterThan(20);
    expect(pm.narrative).not.toContain("—"); // house style: no em dashes
    expect(pm.narrative.toLowerCase()).toContain("breakout"); // hit framing
    expect(pm.narrative).toContain("Pro"); // audience coda names the winning segment
    // The headline likewise carries no em dash.
    expect(pm.headline).not.toContain("—");
  });

  it("narrative is deterministic", () => {
    const a = postMortem(insight({ betterRivals: 2, competitionFactor: 0.4 }), "steady");
    const b = postMortem(insight({ betterRivals: 2, competitionFactor: 0.4 }), "steady");
    expect(a.narrative).toBe(b.narrative);
  });

  it("topFactorSummary surfaces the #1 driver as a capitalised phrase (the reveal's why line)", () => {
    const top = topFactorSummary(insight({ priceFit: 0.4, demandFit: 52 }), "flop");
    expect(top?.key).toBe("price");
    expect(top?.tone).toBe("negative");
    expect(top?.text.toLowerCase()).toContain("price");
    expect(top?.text[0]).toBe(top?.text[0].toUpperCase()); // reads as a standalone line
  });

  it("topFactorSummary is null for a balanced, unremarkable launch (nothing decisive)", () => {
    // Every factor sits near its neutral point, below the dominant floor.
    const top = topFactorSummary(
      insight({ demandFit: 50, priceFit: 1, hype: 1.15, competitionFactor: 1 }),
      "steady",
    );
    expect(top).toBeNull();
  });
});

// ─── The long-form copy layer (lifted out of screens/Market.tsx, where it had no tests) ───────────
// `launchDrivers` / `launchTips` write the player-facing "why did this land like that, and what
// should I do differently" copy in the product detail sheet. Two rules matter: never fabricate a
// number the save doesn't carry (old saves have no `insight`), and always leave the player with a
// concrete next step rather than a list of complaints.

function shipped(over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: {
      id: "p", name: "Aurora", category: "phone",
      tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
      finish: "aluminium", colorIndex: 0, price: dollars(400), designTier: 1,
      camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
    },
    stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(150), launchScore: 60, launchedWeek: 1,
    totalUnits: 1000, weeklyUnits: [500, 500], unitsSold: 900, weeksElapsed: 2, revenueToDate: dollars(9_000),
    ...over,
  };
}

describe("launchDrivers — the plain-language 'why'", () => {
  it("reads real numbers off the recorded insight", () => {
    const d = launchDrivers(shipped({ insight: insight({ demandFit: 78, priceFit: 0.5, betterRivals: 2, hype: 1.9 }) }));
    const by = Object.fromEntries(d.map((x) => [x.key, x]));
    expect(by.demand.value).toBe("78/100");
    expect(by.demand.tone).toBe("positive");
    expect(by.price.value).toBe("Overpriced");
    expect(by.price.tone).toBe("negative");
    expect(by.competition.value).toBe("2 ahead");
    expect(by.hype.value).toBe("High");
  });

  it("falls back to a qualitative read — never an invented number — on a save with no insight", () => {
    const d = launchDrivers(shipped({ launchScore: 12 }));
    expect(d).toHaveLength(1); // only what can be honestly said
    expect(d[0].key).toBe("demand");
    expect(d[0].value).toBe("Weak");
    expect(d[0].value).not.toMatch(/\d/); // no fabricated "/100"
  });

  it("names the winning and losing buyer segments when the save carries them", () => {
    const d = launchDrivers(shipped({
      insight: insight({
        dominantSegment: "pro", weakestSegment: "budget",
        perSegment: [
          { id: "pro", name: "Pro", captured: 0.6, fit: 70, priceFit: 1 },
          { id: "budget", name: "Budget", captured: 0.1, fit: 60, priceFit: 0.4 },
        ],
      }),
    }));
    const audience = d.find((x) => x.key === "audience")!;
    expect(audience.value).toBe("Pro");
    expect(audience.detail).toContain("Budget");
    expect(audience.detail).toContain("priced out"); // the losing segment's REASON, not just its name
  });

  it("skips the audience driver entirely for saves written before segments existed", () => {
    const d = launchDrivers(shipped({ insight: insight({}) }));
    expect(d.find((x) => x.key === "audience")).toBeUndefined();
  });
});

describe("launchTips — the actionable next step", () => {
  it("says nothing at all rather than guessing when there is no insight", () => {
    expect(launchTips(shipped())).toEqual([]);
  });

  it("caps advice at three tips so the sheet never becomes a lecture", () => {
    const tips = launchTips(shipped({
      verdict: "flop",
      insight: insight({ demandFit: 20, priceFit: 0.5, betterRivals: 3, hype: 1 }),
    }));
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips.length).toBeGreaterThan(0);
  });

  it("still leaves a hit with a forward-looking move instead of an empty list", () => {
    const tips = launchTips(shipped({ verdict: "hit", insight: insight({ demandFit: 90, priceFit: 1, hype: 2 }) }));
    expect(tips).toHaveLength(1);
    expect(tips[0]).toContain("successor");
  });

  it("distinguishes one rival edging you out from a field that outclassed you", () => {
    const one = launchTips(shipped({ verdict: "steady", insight: insight({ betterRivals: 1 }) }));
    const many = launchTips(shipped({ verdict: "steady", insight: insight({ betterRivals: 3 }) }));
    expect(one.join(" ")).toContain("One rival");
    expect(many.join(" ")).toContain("Multiple rivals");
  });
});

describe("verdictOf", () => {
  it("prefers the recorded verdict", () => {
    expect(verdictOf(shipped({ verdict: "flop", launchScore: 99 }))).toBe("flop");
  });

  it("derives one from the launch score for saves that predate verdicts", () => {
    expect(verdictOf(shipped({ launchScore: 80 }))).toBe("hit");
    expect(verdictOf(shipped({ launchScore: 50 }))).toBe("solid");
    expect(verdictOf(shipped({ launchScore: 30 }))).toBe("steady");
    expect(verdictOf(shipped({ launchScore: 10 }))).toBe("flop");
  });
});
