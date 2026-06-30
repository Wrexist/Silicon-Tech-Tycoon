import { describe, it, expect } from "vitest";
import { buildLaunchReveal } from "./launchReveal.ts";
import { dollars } from "../engine/money.ts";
import type { LaunchInsight, Product, Stats } from "../engine/types.ts";

function product(): Product {
  return {
    id: "p1",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

const stats: Stats = { performance: 40, quality: 40, battery: 40, design: 40, ecosystem: 40 };

function base() {
  return {
    product: product(),
    stats,
    verdict: "solid" as const,
    demandFit: 60,
    priceFit: 1,
    betterRivals: 0,
    units: 1000,
    isHit: false,
    firstLaunch: false,
  };
}

describe("C2: launch reveal carries the postmortem why", () => {
  it("carries the postmortem headline when an insight is supplied", () => {
    const insight: LaunchInsight = {
      demandFit: 60, priceFit: 1, hype: 1.4, matchingRivals: 0, betterRivals: 0, competitionFactor: 1,
    };
    const data = buildLaunchReveal({ ...base(), insight });
    expect(data.why).toBeDefined();
    expect(data.why!.length).toBeGreaterThan(0);
    // the why is the verdict-keyed postmortem headline (solid launch)
    expect(data.why!.toLowerCase()).toContain("solid");
  });

  it("names competition in the why when rivals outclass a steady launch", () => {
    const insight: LaunchInsight = {
      demandFit: 55, priceFit: 1, hype: 1.1, matchingRivals: 1, betterRivals: 3, competitionFactor: 0.3,
    };
    const data = buildLaunchReveal({ ...base(), verdict: "steady", insight });
    expect(data.why!.toLowerCase()).toContain("rival");
  });

  it("omits the why when no insight is supplied (older saves / no data)", () => {
    const data = buildLaunchReveal(base());
    expect(data.why).toBeUndefined();
    // the critic pull-quote (headline) is still present
    expect(data.headline.length).toBeGreaterThan(0);
  });
});
