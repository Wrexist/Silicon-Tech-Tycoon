import { describe, it, expect } from "vitest";
import { industryBuzz, type BuzzInput } from "./buzz.ts";

const BASE: BuzzInput = {
  company: "Silicon", rank: 4, fieldSize: 13, reputation: 50, fans: 200, listed: false,
  eraProgress: 0.2, valuationDollars: 5_000_000,
  latestLaunch: null, latestRival: null, platformBase: 0, osName: "SiliconOS", licenseeCount: 0,
};

describe("industry buzz", () => {
  it("always leads with the player's standing", () => {
    expect(industryBuzz(BASE)[0].id).toBe("rank");
    expect(industryBuzz({ ...BASE, rank: 1 })[0].text).toMatch(/#1/);
    expect(industryBuzz({ ...BASE, rank: 1 })[0].tone).toBe("hot");
  });

  it("tells the story of the latest launch by verdict", () => {
    const hit = industryBuzz({ ...BASE, latestLaunch: { name: "Aurora", verdict: "hit" } });
    expect(hit.find((l) => l.id === "launch")?.tone).toBe("hot");
    const flop = industryBuzz({ ...BASE, latestLaunch: { name: "Dud", verdict: "flop" } });
    expect(flop.find((l) => l.id === "launch")?.tone).toBe("bad");
  });

  it("surfaces the platform + rivals + momentum when they exist, and stays quiet when they don't", () => {
    const rich = industryBuzz({
      ...BASE, platformBase: 2_400_000, licenseeCount: 2, valuationDollars: 3_000_000_000, fans: 50_000,
      latestRival: { company: "Pomelo", product: "Zenith", category: "phone" },
    });
    const ids = rich.map((l) => l.id);
    expect(ids).toContain("os");
    expect(ids).toContain("rival");
    expect(ids).toContain("val");
    expect(ids).toContain("fans");
    // The bare base (no launch / rival / platform / big numbers) is just the rank line.
    expect(industryBuzz(BASE).map((l) => l.id)).toEqual(["rank"]);
  });
});
