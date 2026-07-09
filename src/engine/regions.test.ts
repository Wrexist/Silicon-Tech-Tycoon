import { describe, it, expect } from "vitest";
import { REGIONS, regionById, regionTasteFit, regionReach, shippableRegions, worldCoverage, regionWorldShare, regionTasteTop } from "./regions.ts";
import { BALANCE } from "./balance.ts";
import type { RegionId, Stats } from "./types.ts";

const flat: Stats = { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 };

describe("regions catalog", () => {
  it("has unique ids, a free always-on home, and paid expansions", () => {
    const ids = REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const home = regionById("home")!;
    expect(home.unlockCost).toBe(0);
    expect(home.share).toBe(1.0);
    for (const r of REGIONS) if (r.id !== "home") expect(r.unlockCost).toBeGreaterThan(0);
  });
});

describe("regionTasteFit", () => {
  it("home always fits exactly 1.0, regardless of stats", () => {
    expect(regionTasteFit(flat, regionById("home")!)).toBe(1.0);
    const lopsided: Stats = { performance: 100, quality: 0, battery: 0, design: 0, ecosystem: 0 };
    expect(regionTasteFit(lopsided, regionById("home")!)).toBe(1.0);
  });

  it("a flat product scores ~1.0 in every region", () => {
    for (const r of REGIONS) {
      expect(regionTasteFit(flat, r)).toBeCloseTo(1.0, 5);
    }
  });

  it("is bounded to [fitMin, fitMax] and rewards matching the region's taste", () => {
    const na = regionById("north_america")!; // values performance + ecosystem
    const perfHeavy: Stats = { performance: 100, quality: 30, battery: 10, design: 30, ecosystem: 90 };
    const perfWeak: Stats = { performance: 5, quality: 60, battery: 90, design: 80, ecosystem: 10 };
    const good = regionTasteFit(perfHeavy, na);
    const bad = regionTasteFit(perfWeak, na);
    expect(good).toBeGreaterThan(bad);
    for (const f of [good, bad]) {
      expect(f).toBeGreaterThanOrEqual(BALANCE.market.regions.fitMin);
      expect(f).toBeLessThanOrEqual(BALANCE.market.regions.fitMax);
    }
  });
});

describe("shippableRegions", () => {
  it("intersects chosen with unlocked and defaults to home", () => {
    expect(shippableRegions(["home"], undefined)).toEqual(["home"]);
    expect(shippableRegions(["home", "asia"], ["asia", "europe"])).toEqual(["asia"]); // europe not unlocked
    expect(shippableRegions(["home"], [])).toEqual(["home"]);
    expect(shippableRegions([], ["asia"])).toEqual(["home"]); // nothing unlocked → home floor
  });
});

describe("regionReach", () => {
  it("home-only is exactly 1.0 (no regression for old saves / domestic launches)", () => {
    expect(regionReach(["home"], ["home"], flat)).toBe(1.0);
    expect(regionReach(["home"], undefined, flat)).toBe(1.0);
    // unselected regions never apply even if unlocked
    expect(regionReach(["home", "asia", "europe"], ["home"], flat)).toBe(1.0);
  });

  it("adds each shipped region's share (×~1 for a flat product), growing total reach", () => {
    const homeOnly = regionReach(["home", "asia"], ["home"], flat);
    const plusAsia = regionReach(["home", "asia"], ["home", "asia"], flat);
    expect(plusAsia).toBeGreaterThan(homeOnly);
    // flat product: reach ≈ home.share + asia.share
    expect(plusAsia).toBeCloseTo(1.0 + regionById("asia")!.share, 5);
  });

  it("can never ship to a region that isn't unlocked", () => {
    const unlocked: RegionId[] = ["home"];
    expect(regionReach(unlocked, ["home", "asia", "europe"], flat)).toBe(1.0);
  });
});

describe("region UI helpers (worldCoverage / share / taste)", () => {
  it("worldCoverage climbs from a home-only slice to 100% when every market is open", () => {
    const homeOnly = worldCoverage(["home"]);
    expect(homeOnly).toBeGreaterThan(0);
    expect(homeOnly).toBeLessThan(1);
    const all = worldCoverage(REGIONS.map((r) => r.id));
    expect(all).toBeCloseTo(1, 6);
    // Opening another market strictly increases coverage.
    expect(worldCoverage(["home", "asia"])).toBeGreaterThan(homeOnly);
  });

  it("regionWorldShare is each region's slice of the world and sums to 1", () => {
    const sum = REGIONS.reduce((a, r) => a + regionWorldShare(r), 0);
    expect(sum).toBeCloseTo(1, 6);
    // Asia is the largest single market in the catalog.
    expect(regionWorldShare(regionById("asia")!)).toBeGreaterThan(regionWorldShare(regionById("europe")!));
  });

  it("regionTasteTop names what a market values (empty for flat Home)", () => {
    expect(regionTasteTop(regionById("home")!)).toEqual([]);
    // Europe rewards quality + design (its two heaviest weights).
    expect(new Set(regionTasteTop(regionById("europe")!, 2))).toEqual(new Set(["quality", "design"]));
    expect(regionTasteTop(regionById("north_america")!, 1)).toEqual(["performance"]);
  });
});
