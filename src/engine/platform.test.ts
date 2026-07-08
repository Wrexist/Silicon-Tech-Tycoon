import { describe, it, expect } from "vitest";
import {
  installedBase,
  osTier,
  canReleaseVersion,
  osReleaseReward,
  rivalLicenseFee,
  OS_FEATURES,
  osFeatureById,
  osEcosystemBonus,
  osServicesMultiplier,
  osFeatureRows,
  canInstallOsFeature,
  OS_SYNERGIES,
  activeOsSynergies,
  osSynergyRows,
  OS_PHILOSOPHIES,
  osPhilosophyById,
  philosophyStatBonus,
  philosophyServicesMult,
  philosophyEffectLabel,
  updateLicenseeRelations,
  licenseeMood,
  appsPublishedPerWeek,
  storeCommission,
  featuredApps,
  clampSecurity,
  threatRisePerWeek,
  netExposure,
  securityStanding,
  patchCooldownLeft,
} from "./platform.ts";
import { BALANCE } from "./balance.ts";
import { toDollars } from "./money.ts";
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

describe("rivalLicenseFee", () => {
  const p = BALANCE.platform;
  it("scales with rival reputation × OS tier, off a base", () => {
    expect(toDollars(rivalLicenseFee(0, 1))).toBe(p.licenseFeeBase);
    expect(toDollars(rivalLicenseFee(50, 3))).toBe(p.licenseFeeBase + 50 * 3 * p.licenseFeePerRepTier);
  });
  it("is hard-capped (bounded income) and floors tier at 1", () => {
    expect(toDollars(rivalLicenseFee(100, 99))).toBe(p.licenseFeeCap);
    expect(toDollars(rivalLicenseFee(10, 0))).toBe(p.licenseFeeBase + 10 * 1 * p.licenseFeePerRepTier);
  });
});

describe("OS feature modules — catalog integrity", () => {
  it("has unique ids, sane versions and non-negative effects", () => {
    const ids = new Set(OS_FEATURES.map((f) => f.id));
    expect(ids.size).toBe(OS_FEATURES.length);
    for (const f of OS_FEATURES) {
      expect(f.minVersion).toBeGreaterThanOrEqual(1);
      expect(f.rpCost).toBeGreaterThan(0);
      expect(f.ecoBonus).toBeGreaterThanOrEqual(0);
      expect(f.servicesMult).toBeGreaterThanOrEqual(0);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.blurb.length).toBeGreaterThan(0);
      expect(f.icon.length).toBeGreaterThan(0);
    }
  });
  it("at least one module is available from OS v1 (so the system is reachable early)", () => {
    expect(OS_FEATURES.some((f) => f.minVersion === 1)).toBe(true);
  });
});

describe("osEcosystemBonus", () => {
  it("is 0 with no modules (backward compatible) and sums installed modules", () => {
    expect(osEcosystemBonus([])).toBe(0);
    const app = osFeatureById("appMarket")!;
    const cloud = osFeatureById("cloudSync")!;
    expect(osEcosystemBonus(["appMarket"])).toBe(app.ecoBonus);
    expect(osEcosystemBonus(["appMarket", "cloudSync"])).toBe(app.ecoBonus + cloud.ecoBonus);
  });
  it("ignores unknown ids and is hard-capped", () => {
    expect(osEcosystemBonus(["nope"])).toBe(0);
    const all = OS_FEATURES.map((f) => f.id);
    expect(osEcosystemBonus(all)).toBeLessThanOrEqual(BALANCE.platform.features.ecoBonusCap);
  });
});

describe("osServicesMultiplier", () => {
  it("is exactly 1 at v1 with no modules (the base economy is untouched)", () => {
    expect(osServicesMultiplier(1, [])).toBe(1);
    expect(osServicesMultiplier(0, [])).toBe(1);
    expect(osServicesMultiplier(undefined as unknown as number, [])).toBe(1);
  });
  it("rises with version and with each installed module, and is capped", () => {
    const f = BALANCE.platform.features;
    expect(osServicesMultiplier(3, [])).toBeCloseTo(1 + 2 * f.versionServicesStep, 9);
    const withApp = osServicesMultiplier(1, ["appMarket"]);
    expect(withApp).toBeGreaterThan(1);
    expect(osServicesMultiplier(5, OS_FEATURES.map((x) => x.id))).toBeLessThanOrEqual(f.servicesMultCap);
  });
});

describe("OS module synergies", () => {
  it("each synergy requires two real, distinct modules and a positive bonus", () => {
    const ids = new Set(OS_FEATURES.map((f) => f.id));
    for (const s of OS_SYNERGIES) {
      expect(s.requires[0]).not.toBe(s.requires[1]);
      expect(ids.has(s.requires[0])).toBe(true);
      expect(ids.has(s.requires[1])).toBe(true);
      expect(s.servicesMult).toBeGreaterThan(0);
    }
  });
  it("activates only when BOTH required modules are installed", () => {
    const s = OS_SYNERGIES[0];
    expect(activeOsSynergies([s.requires[0]])).toHaveLength(0); // one half → inactive
    expect(activeOsSynergies([s.requires[0], s.requires[1]]).map((x) => x.id)).toContain(s.id);
  });
  it("an active synergy lifts the services multiplier beyond the two modules alone", () => {
    const s = OS_SYNERGIES[0];
    const both = osServicesMultiplier(1, [s.requires[0], s.requires[1]]);
    // Same two modules but synergy disabled by removing one and adding an unrelated module isn't
    // a clean control; instead assert the synergy bonus is included in the pair's multiplier.
    const modulesOnly =
      1 + (osFeatureById(s.requires[0])!.servicesMult + osFeatureById(s.requires[1])!.servicesMult);
    expect(both).toBeCloseTo(modulesOnly + s.servicesMult, 9);
  });
  it("osSynergyRows reports active/locked state", () => {
    const rows = osSynergyRows([OS_SYNERGIES[0].requires[0]]);
    expect(rows.find((r) => r.id === OS_SYNERGIES[0].id)!.active).toBe(false);
    const rows2 = osSynergyRows([...OS_SYNERGIES[0].requires]);
    expect(rows2.find((r) => r.id === OS_SYNERGIES[0].id)!.active).toBe(true);
  });
});

describe("updateLicenseeRelations (churn)", () => {
  const reps: Record<string, number> = { r1: 40 };
  const env = (playerReputation: number, rng: () => number, health: Record<string, number> = {}) =>
    updateLicenseeRelations({
      licensees: ["r1"],
      health,
      playerReputation,
      rivalRepById: (id) => reps[id],
      rivalNameById: () => "Rival One",
      rng,
    });

  it("satisfaction recovers toward 100 when you are not dominating", () => {
    const r = env(45, () => 0.99, { r1: 50 }); // rep lead 5 < tolerated gap → recover
    expect(r.health.r1).toBeGreaterThan(50);
    expect(r.licensees).toEqual(["r1"]);
    expect(r.dropped).toHaveLength(0);
  });
  it("satisfaction decays when your reputation lead is large", () => {
    const r = env(100, () => 0.99, { r1: 80 }); // huge lead → decay (rng high → no churn yet)
    expect(r.health.r1).toBeLessThan(80);
  });
  it("an unhappy licensee can churn (and is reported), with rng below the chance", () => {
    const r = env(100, () => 0, { r1: 10 }); // already low + rng 0 → drops
    expect(r.licensees).toHaveLength(0);
    expect(r.dropped.map((d) => d.id)).toEqual(["r1"]);
  });
  it("prunes a licensee whose rival no longer exists", () => {
    const r = updateLicenseeRelations({
      licensees: ["ghost"], health: { ghost: 90 }, playerReputation: 50,
      rivalRepById: () => undefined, rivalNameById: () => "Ghost", rng: () => 0.99,
    });
    expect(r.licensees).toHaveLength(0);
    expect(r.dropped).toHaveLength(0); // silent prune, not a churn event
  });
  it("licenseeMood buckets satisfaction sensibly", () => {
    expect(licenseeMood(95)).toBe("happy");
    expect(licenseeMood(70)).toBe("content");
    expect(licenseeMood(40)).toBe("strained");
    expect(licenseeMood(10)).toBe("at-risk");
  });
});

describe("OS philosophy", () => {
  it("has unique ids, a non-empty effect, and a readable label for each", () => {
    const ids = new Set(OS_PHILOSOPHIES.map((p) => p.id));
    expect(ids.size).toBe(OS_PHILOSOPHIES.length);
    for (const p of OS_PHILOSOPHIES) {
      const hasStat = Object.keys(p.statBonus).length > 0;
      expect(hasStat || p.servicesMult > 0).toBe(true); // every philosophy does something
      expect(philosophyEffectLabel(p).length).toBeGreaterThan(0);
    }
  });
  it("none/unknown ids are inert (backward compatible)", () => {
    expect(philosophyStatBonus(null)).toEqual({});
    expect(philosophyStatBonus(undefined)).toEqual({});
    expect(philosophyStatBonus("ghost")).toEqual({});
    expect(philosophyServicesMult(null)).toBe(0);
    expect(osPhilosophyById(null)).toBeUndefined();
  });
  it("maps a chosen philosophy to its tilt", () => {
    expect(philosophyStatBonus("performance")).toEqual({ performance: 5 });
    expect(philosophyServicesMult("open")).toBeGreaterThan(0);
    expect(philosophyStatBonus("open")).toEqual({});
  });
});

describe("osFeatureRows / canInstallOsFeature — gating", () => {
  it("locks modules behind their OS version and behind affordability", () => {
    // v1, plenty of RP: v1 modules available, higher-version ones locked.
    const rows = osFeatureRows([], 1, 9999);
    const app = rows.find((r) => r.id === "appMarket")!;
    const cont = rows.find((r) => r.id === "continuity")!; // minVersion 4
    expect(app.status).toBe("available");
    expect(cont.status).toBe("locked");
    // Owned shows installed; unaffordable when RP is short.
    expect(osFeatureRows(["appMarket"], 1, 9999).find((r) => r.id === "appMarket")!.status).toBe("installed");
    expect(osFeatureRows([], 1, 0).find((r) => r.id === "appMarket")!.status).toBe("unaffordable");
  });
  it("canInstallOsFeature mirrors the gates and rejects re-install / unknown", () => {
    const appCost = osFeatureById("appMarket")!.rpCost; // catalog-driven so tuning can't break the test
    expect(canInstallOsFeature([], 1, appCost, "appMarket")).toBe(true);
    expect(canInstallOsFeature([], 1, appCost - 1, "appMarket")).toBe(false); // can't afford
    expect(canInstallOsFeature([], 1, 9999, "continuity")).toBe(false); // version too low
    expect(canInstallOsFeature(["appMarket"], 1, 9999, "appMarket")).toBe(false); // already owned
    expect(canInstallOsFeature([], 1, 9999, "ghost")).toBe(false); // unknown id
  });
});

describe("App Store", () => {
  it("is dormant until the App Marketplace module ships", () => {
    const dormant = appsPublishedPerWeek(10_000_000, 4, false);
    const open = appsPublishedPerWeek(10_000_000, 4, true);
    expect(dormant).toBe(BALANCE.platform.appStore.dormantAppsPerWeek);
    expect(open).toBeGreaterThan(dormant);
  });
  it("grows with installed base and OS version once open", () => {
    expect(appsPublishedPerWeek(20_000_000, 4, true)).toBeGreaterThan(appsPublishedPerWeek(1_000_000, 4, true));
    expect(appsPublishedPerWeek(1_000_000, 5, true)).toBeGreaterThan(appsPublishedPerWeek(1_000_000, 1, true));
  });
  it("commission scales with the catalogue but is capped and non-negative", () => {
    expect(toDollars(storeCommission(0))).toBe(0);
    expect(toDollars(storeCommission(-5))).toBe(0);
    expect(toDollars(storeCommission(1000))).toBeGreaterThan(0);
    expect(toDollars(storeCommission(10_000_000))).toBe(BALANCE.platform.appStore.storeCutCapDollars);
  });
  it("featured apps are deterministic, IP-safe procedural names, stable within a size bucket", () => {
    const a = featuredApps(42, 100, 3, 4);
    const b = featuredApps(42, 100, 3, 4);
    expect(a).toEqual(b);                       // deterministic
    expect(a).toHaveLength(4);
    expect(new Set(a.map((x) => x.name)).size).toBe(4); // no dupes
    for (const app of a) {
      expect(app.name).toMatch(/^[A-Za-z]+$/);
      expect(app.rating).toBeGreaterThanOrEqual(4.1);
      expect(app.rating).toBeLessThanOrEqual(4.9);
    }
    // Crossing a 250-app bucket refreshes the strip.
    expect(featuredApps(42, 600, 3, 4)).not.toEqual(a);
  });
});

describe("Security tug-of-war", () => {
  it("clamps to 0..100", () => {
    expect(clampSecurity(-10)).toBe(0);
    expect(clampSecurity(150)).toBe(100);
    expect(clampSecurity(Number.NaN)).toBe(0);
  });
  it("threat rises with the installed base and is halved by the Privacy Suite", () => {
    const big = threatRisePerWeek(50_000_000, false);
    const small = threatRisePerWeek(0, false);
    expect(big).toBeGreaterThanOrEqual(small);
    expect(big).toBeLessThanOrEqual(BALANCE.platform.security.threatRiseCap);
    expect(threatRisePerWeek(5_000_000, true)).toBeCloseTo(threatRisePerWeek(5_000_000, false) * BALANCE.platform.security.privacySuiteMitigation);
  });
  it("net exposure is threat outrunning hardening, clamped", () => {
    expect(netExposure(80, 30)).toBe(50);
    expect(netExposure(30, 80)).toBe(0); // hardening covers the threat
  });
  it("standing worsens as exposure climbs", () => {
    expect(securityStanding(0, 60).key).toBe("fortified");
    expect(securityStanding(90, 0).key).toBe("critical");
    expect(securityStanding(70, 0).key).toBe("exposed");
  });
  it("patch cooldown counts down from the last patch week", () => {
    const cd = BALANCE.platform.security.patchCooldownWeeks;
    expect(patchCooldownLeft(10, undefined)).toBe(0); // never patched → ready
    expect(patchCooldownLeft(10, 10)).toBe(cd);       // just patched
    expect(patchCooldownLeft(10 + cd, 10)).toBe(0);   // fully elapsed
  });
});
