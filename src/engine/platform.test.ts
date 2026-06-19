import { describe, it, expect } from "vitest";
import { installedBase, osTier, canReleaseVersion, osReleaseReward } from "./platform.ts";
import { BALANCE } from "./balance.ts";
import type { LaunchedProduct } from "./types.ts";

function lp(unitsSold: number): LaunchedProduct {
  return {
    product: { id: "p", name: "P", category: "phone", tiers: {}, finish: "aluminium", colorIndex: 0, price: 0 as never, designTier: 1, camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: false }, notch: "none" },
    stats: { performance: 0, quality: 0, battery: 0, design: 0, ecosystem: 0 },
    unitCost: 0 as never, launchScore: 0, launchedWeek: 0, totalUnits: 0, weeklyUnits: [], unitsSold, weeksElapsed: 0, revenueToDate: 0 as never,
  };
}

describe("installedBase", () => {
  it("sums units sold across launched products", () => {
    expect(installedBase([])).toBe(0);
    expect(installedBase([lp(1000), lp(2500), lp(0)])).toBe(3500);
  });
});

describe("osTier", () => {
  it("maps the software research level to the tier name (clamped ≥1)", () => {
    expect(osTier(1).name).toBe("BasicOS");
    expect(osTier(3).tier).toBe(3);
    expect(osTier(3).name).toBe("Ecosystem OS");
    expect(osTier(undefined).tier).toBe(1);
    expect(osTier(0).tier).toBe(1);
  });
});

describe("canReleaseVersion", () => {
  it("is true only when research has advanced past the released version", () => {
    expect(canReleaseVersion(1, 1)).toBe(false); // up to date
    expect(canReleaseVersion(1, 3)).toBe(true);  // researched ahead
    expect(canReleaseVersion(3, 3)).toBe(false);
    expect(canReleaseVersion(2, 5)).toBe(true);
  });
});

describe("osReleaseReward", () => {
  it("gives a flat reputation bump and a base-scaled, capped fan bonus", () => {
    const p = BALANCE.platform;
    expect(osReleaseReward(0)).toEqual({ reputation: p.releaseRepBonus, fans: p.releaseFanBaseBonus });
    // 10,000 installed → +10 * perK fans on top of base.
    expect(osReleaseReward(10_000).fans).toBe(p.releaseFanBaseBonus + 10 * p.releaseFanPerKInstalled);
  });

  it("hard-caps the fan bonus (no free faucet) even for a vast installed base", () => {
    expect(osReleaseReward(1_000_000_000).fans).toBe(BALANCE.platform.releaseFanCap);
  });

  it("never rewards negative installed base", () => {
    expect(osReleaseReward(-50).fans).toBe(BALANCE.platform.releaseFanBaseBonus);
  });
});
