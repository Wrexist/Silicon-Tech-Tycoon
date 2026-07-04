import { describe, it, expect } from "vitest";
import { postMortem, topFactorSummary, type FactorKey } from "./postmortem.ts";
import type { LaunchInsight } from "./types.ts";

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
