// State-layer Platform division: entitlement gate, OS naming, version-release reward + gating.
import { describe, it, expect } from "vitest";
import {
  newGame,
  unlockPlatform,
  setOsName,
  releaseOsVersion,
  osDisplayName,
  osTierInfo,
  canReleaseOsVersion,
  licenseOsToRival,
  revokeOsLicense,
  signLicenseOffer,
  declineLicenseOffer,
  negotiateLicenseOffer,
  weeklyLicenseFees,
  installOsFeature,
  canInstallFeature,
  osFeatureList,
  osEcoBonus,
  osServicesMult,
  productStats,
  weeklyEcosystemRevenue,
  advanceOneWeek,
  setOsPhilosophy,
  licenseeHealthOf,
  foundPlatform,
  canFoundPlatform,
  platformFoundingCost,
  shipSecurityPatch,
  platformAppCount,
  appStoreOpen,
  osThreatLevel,
  osSecurityRating,
  canShipSecurityPatch,
  weeklyStoreCommission,
  type GameState,
} from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { rivalLicenseFee, osFeatureById } from "../engine/platform.ts";
import { add, ZERO, dollars, toDollars } from "../engine/money.ts";
import type { Product, LaunchedProduct } from "../engine/types.ts";

describe("founding the Platform division (earned cash milestone)", () => {
  // A state that meets the earned-milestone gate (reputation + shipped track record) with `extra` cash
  // beyond the founding cost. Reputation and shipped count are pushed above the requirement.
  const eligible = (extraCash: number): GameState => ({
    ...newGame(1),
    cash: add(platformFoundingCost(), dollars(extraCash)),
    reputation: BALANCE.platform.foundingMinReputation + 5,
    launched: Array.from({ length: BALANCE.platform.foundingMinShipped }, (_, i) => ({ id: `p${i}` })),
  } as unknown as GameState);

  it("is a one-time purchase gated on cost + earned reputation + a shipped track record", () => {
    const cost = platformFoundingCost();

    // Can afford, but a fresh nobody (low rep, nothing shipped) can't found it.
    const nobody = { ...newGame(1), cash: add(cost, dollars(5_000)) } as GameState;
    expect(nobody.reputation).toBeLessThan(BALANCE.platform.foundingMinReputation);
    expect(canFoundPlatform(nobody)).toBe(false);
    expect(foundPlatform(nobody)).toBe(nobody); // no-op — the gate isn't met

    // Established brand, but can't afford it → still blocked.
    const broke = eligible(-1); // one cent short of the cost
    expect(canFoundPlatform(broke)).toBe(false);

    // Meets every requirement → can found, pays exactly the cost.
    const ready = eligible(5_000);
    expect(canFoundPlatform(ready)).toBe(true);
    const founded = foundPlatform(ready);
    expect(founded.platformUnlocked).toBe(true);
    expect(founded.cash).toBe(dollars(5_000)); // paid exactly the founding cost
    expect(canFoundPlatform(founded)).toBe(false); // already founded
    expect(foundPlatform(founded)).toBe(founded); // no-op the second time
  });
});

describe("platform entitlement + naming", () => {
  it("defaults locked, with a derived OS name", () => {
    const g = newGame(1);
    expect(g.platformUnlocked).toBe(false);
    expect(g.osName).toBe("");
    expect(osDisplayName(g)).toBe("Silicon OS"); // default company name
  });

  it("unlock toggles the entitlement; setOsName overrides the display name", () => {
    let g = unlockPlatform(newGame(1), true);
    expect(g.platformUnlocked).toBe(true);
    g = setOsName(g, "Nucleus");
    expect(g.osName).toBe("Nucleus");
    expect(osDisplayName(g)).toBe("Nucleus");
    g = setOsName(g, "   ");
    expect(osDisplayName(g)).toBe("Silicon OS"); // blank falls back
  });
});

describe("releaseOsVersion", () => {
  it("is a no-op while locked, or when research hasn't moved ahead", () => {
    const locked = { ...newGame(1), researched: { software: 3 } };
    expect(releaseOsVersion(locked)).toBe(locked); // platform locked

    const unlockedUpToDate = unlockPlatform({ ...newGame(1), researched: { software: 1 }, osVersion: 1 }, true);
    expect(canReleaseOsVersion(unlockedUpToDate)).toBe(false);
    expect(releaseOsVersion(unlockedUpToDate)).toBe(unlockedUpToDate);
  });

  it("catches the version up to research and grants the bounded rep/fan reward", () => {
    const g = unlockPlatform({ ...newGame(1), researched: { software: 3 }, osVersion: 1, reputation: 40, fans: 1000 }, true);
    expect(osTierInfo(g).tier).toBe(3);
    expect(canReleaseOsVersion(g)).toBe(true);

    const after = releaseOsVersion(g);
    expect(after.osVersion).toBe(3);
    expect(after.reputation).toBe(40 + BALANCE.platform.releaseRepBonus);
    expect(after.fans).toBe(1000 + BALANCE.platform.releaseFanBaseBonus); // 0 installed base → base bonus
    expect(canReleaseOsVersion(after)).toBe(false); // now up to date
  });

  it("clamps reputation at 100", () => {
    const g = unlockPlatform({ ...newGame(1), researched: { software: 2 }, osVersion: 1, reputation: 99 }, true);
    expect(releaseOsVersion(g).reputation).toBe(100);
  });
});

describe("OS licensing (Phase C)", () => {
  it("requires the division unlocked + a real rival, and is idempotent", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    expect(licenseOsToRival(base, rid)).toBe(base); // locked → no-op

    const g = unlockPlatform(base, true);
    const licensed = licenseOsToRival(g, rid);
    expect(licensed.osLicensees).toContain(rid);
    expect(licenseOsToRival(licensed, rid).osLicensees).toHaveLength(1); // no dupes
    expect(licenseOsToRival(g, "ghost").osLicensees).toHaveLength(0);    // unknown rival
  });

  it("weeklyLicenseFees sums each licensee's fee; revoke drops it to zero", () => {
    let g = unlockPlatform({ ...newGame(1), researched: { software: 2 } }, true);
    expect(weeklyLicenseFees(g)).toBe(ZERO);

    const [a, b] = g.competitors;
    g = licenseOsToRival(licenseOsToRival(g, a.id), b.id);
    const expected = add(rivalLicenseFee(a.reputation, 2), rivalLicenseFee(b.reputation, 2));
    expect(weeklyLicenseFees(g)).toBe(expected);

    g = revokeOsLicense(g, a.id);
    expect(g.osLicensees).toEqual([b.id]);
    expect(weeklyLicenseFees(g)).toBe(rivalLicenseFee(b.reputation, 2));
  });

  it("licensing seeds full satisfaction; revoking prunes the entry", () => {
    const base = unlockPlatform(newGame(3), true);
    const rid = base.competitors[0].id;
    const g = licenseOsToRival(base, rid);
    expect(licenseeHealthOf(g, rid)).toBe(BALANCE.platform.licenseeChurn.startHealth);
    expect(g.osLicenseeHealth[rid]).toBe(BALANCE.platform.licenseeChurn.startHealth);
    const off = revokeOsLicense(g, rid);
    expect(off.osLicenseeHealth[rid]).toBeUndefined();
  });

  it("a tick erodes a dominated licensee's satisfaction (live play)", () => {
    let g = unlockPlatform({ ...newGame(3), reputation: 70 } as GameState, true);
    // Weaken the first rival so the player has a commanding reputation lead.
    g = { ...g, competitors: g.competitors.map((c, i) => (i === 0 ? { ...c, reputation: 30 } : c)) };
    const rid = g.competitors[0].id;
    g = licenseOsToRival(g, rid);
    const after = advanceOneWeek(g);
    expect(after.osLicensees).toContain(rid);                 // still licensed after one week
    expect(licenseeHealthOf(after, rid)).toBeLessThan(BALANCE.platform.licenseeChurn.startHealth); // but less content
  });

  it("offline catch-up never changes licensee relationships", () => {
    let g = unlockPlatform({ ...newGame(3), reputation: 90 } as GameState, true);
    g = { ...g, competitors: g.competitors.map((c, i) => (i === 0 ? { ...c, reputation: 20 } : c)) };
    const rid = g.competitors[0].id;
    g = licenseOsToRival(g, rid);
    const after = advanceOneWeek(g, 0.5, true); // offline tick
    expect(licenseeHealthOf(after, rid)).toBe(BALANCE.platform.licenseeChurn.startHealth); // untouched while away
  });
});

function phone(): Product {
  return {
    id: "p", name: "Aurora", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(500), designTier: 1,
    camera: { count: 1, layout: "vertical", module: "squircle", flash: false, position: "topLeft" },
    notch: "none",
  };
}
function soldPhone(ecosystem: number, unitsSold: number): LaunchedProduct {
  return {
    product: phone(),
    stats: { performance: 40, quality: 40, battery: 40, design: 40, ecosystem },
    unitCost: dollars(0), launchScore: 0, launchedWeek: 0, totalUnits: unitsSold,
    weeklyUnits: [], unitsSold, weeksElapsed: 0, revenueToDate: dollars(0),
  };
}

describe("OS feature modules (state)", () => {
  it("installs only when unlocked, version-reached and affordable — spending the RP", () => {
    const app = osFeatureById("appMarket")!;
    const locked = { ...newGame(1), researchPoints: 9999 };
    expect(canInstallFeature(locked, "appMarket")).toBe(false);      // division off
    expect(installOsFeature(locked, "appMarket")).toBe(locked);       // no-op

    const g = unlockPlatform({ ...newGame(1), osVersion: 1, researchPoints: 9999 }, true);
    expect(canInstallFeature(g, "appMarket")).toBe(true);
    expect(canInstallFeature(g, "continuity")).toBe(false);           // minVersion 4 > v1
    const after = installOsFeature(g, "appMarket");
    expect(after.osFeatures).toContain("appMarket");
    expect(after.researchPoints).toBe(9999 - app.rpCost);
    expect(installOsFeature(after, "appMarket")).toBe(after);         // idempotent

    const broke = unlockPlatform({ ...newGame(1), osVersion: 1, researchPoints: 0 }, true);
    expect(installOsFeature(broke, "appMarket")).toBe(broke);         // can't afford
  });

  it("osFeatureList reports a v1 module available and a v4 module locked", () => {
    const g = unlockPlatform({ ...newGame(1), osVersion: 1, researchPoints: 9999 }, true);
    const rows = osFeatureList(g);
    expect(rows.find((r) => r.id === "appMarket")!.status).toBe("available");
    expect(rows.find((r) => r.id === "continuity")!.status).toBe("locked");
  });

  it("a module lifts the ecosystem stat of every device you launch (the real lever)", () => {
    const g = unlockPlatform({ ...newGame(1), osVersion: 1, researchPoints: 9999 }, true);
    const before = productStats(g, phone()).ecosystem;
    const withApp = installOsFeature(g, "appMarket");
    const after = productStats(withApp, phone()).ecosystem;
    expect(after).toBe(before + osFeatureById("appMarket")!.ecoBonus);
    expect(osEcoBonus(withApp)).toBe(osFeatureById("appMarket")!.ecoBonus);
    // and a locked game gets no bonus at all
    expect(osEcoBonus({ ...newGame(1), osFeatures: ["appMarket"] })).toBe(0);
  });

  it("modules + version multiply recurring services income; base game is untouched (mult 1)", () => {
    const launched = [soldPhone(50, 10_000)];
    const base = { ...newGame(1), launched } as GameState;        // division off
    expect(osServicesMult(base)).toBe(1);
    const baseRev = toDollars(weeklyEcosystemRevenue(base));

    const unlocked = unlockPlatform({ ...newGame(1), launched, osVersion: 1, researchPoints: 9999 }, true);
    expect(osServicesMult(unlocked)).toBe(1);                      // v1, no modules → unchanged
    expect(toDollars(weeklyEcosystemRevenue(unlocked))).toBeCloseTo(baseRev, 6);

    const withApp = installOsFeature(unlocked, "appMarket");
    expect(osServicesMult(withApp)).toBeGreaterThan(1);
    expect(toDollars(weeklyEcosystemRevenue(withApp))).toBeGreaterThan(baseRev);
  });

  it("OS philosophy tilts a launch stat + services, and is gated/togglable", () => {
    // Locked: choosing does nothing.
    expect(setOsPhilosophy(newGame(1), "performance").osPhilosophy).toBeNull();

    const g = unlockPlatform(newGame(1), true);
    const chosen = setOsPhilosophy(g, "performance");
    expect(chosen.osPhilosophy).toBe("performance");
    // Performance-First lifts the performance stat of a launched device.
    const before = productStats(g, phone()).performance;
    const after = productStats(chosen, phone()).performance;
    expect(after).toBe(before + 5);
    // Choosing the same one again clears it (toggle).
    expect(setOsPhilosophy(chosen, "performance").osPhilosophy).toBeNull();
    // "Open" lifts the services multiplier instead.
    expect(osServicesMult(setOsPhilosophy(g, "open"))).toBeGreaterThan(osServicesMult(g));
  });

  it("records an installed-base sample each week only while the division is unlocked", () => {
    // Locked: history stays empty across a tick.
    const locked = advanceOneWeek({ ...newGame(7), platformUnlocked: false });
    expect(locked.osBaseHistory).toEqual([]);

    // Unlocked with a launched product: a tick appends one sample = the installed base.
    const sold = [soldPhone(50, 12_345)];
    const g = unlockPlatform({ ...newGame(7), launched: sold } as GameState, true);
    const after = advanceOneWeek(g);
    expect(after.osBaseHistory.length).toBe(1);
    expect(after.osBaseHistory[0]).toBeGreaterThanOrEqual(12_345); // ≥ this week's installed base
  });
});

describe("Living App Store (state + tick)", () => {
  it("stays closed until the App Marketplace module ships, then the catalogue grows", () => {
    const sold = [soldPhone(50, 5_000_000)];
    const dormant = unlockPlatform({ ...newGame(7), launched: sold, osVersion: 3, researchPoints: 9999 } as GameState, true);
    expect(appStoreOpen(dormant)).toBe(false);
    const open = installOsFeature(dormant, "appMarket");
    expect(appStoreOpen(open)).toBe(true);
    // A tick on the OPEN store publishes far more apps than the dormant trickle.
    expect(platformAppCount(advanceOneWeek(open))).toBeGreaterThan(platformAppCount(advanceOneWeek(dormant)));
  });

  it("store commission is bounded, gated on the division, and folds into weekly ecosystem revenue", () => {
    const many = unlockPlatform({ ...newGame(1), osApps: 10_000 } as GameState, true);
    expect(toDollars(weeklyStoreCommission(many))).toBeGreaterThan(0);
    // Locked game earns nothing from a (stale) app count → sim-safe.
    expect(weeklyStoreCommission({ ...newGame(1), osApps: 10_000 })).toBe(ZERO);
    // The commission is part of the headline ecosystem-revenue figure.
    const noStore = { ...many, osApps: 0 } as GameState;
    expect(toDollars(weeklyEcosystemRevenue(many))).toBeGreaterThan(toDollars(weeklyEcosystemRevenue(noStore)));
  });
});

describe("OS security (state + tick)", () => {
  it("shipping a patch clears threat, hardens, and then sits on cooldown", () => {
    const g = unlockPlatform({ ...newGame(7), osThreat: 40, osSecurity: 0, week: 20 } as GameState, true);
    const res = shipSecurityPatch(g);
    expect(res.ok).toBe(true);
    expect(osThreatLevel(res.state)).toBeLessThan(40);                                   // threat patched down
    expect(osSecurityRating(res.state)).toBe(BALANCE.platform.security.patchSecurityGain); // hardened
    expect(res.state.lastPatchWeek).toBe(20);
    expect(canShipSecurityPatch(res.state)).toBe(false);   // cooldown
    expect(shipSecurityPatch(res.state).ok).toBe(false);
    expect(shipSecurityPatch(newGame(1)).ok).toBe(false);  // locked → no-op
  });

  it("threat rises in live play but never while offline", () => {
    const sold = [soldPhone(50, 20_000_000)];
    const g = unlockPlatform({ ...newGame(7), launched: sold, osThreat: 0, osSecurity: 0 } as GameState, true);
    expect(osThreatLevel(advanceOneWeek(g))).toBeGreaterThan(0);       // climbs live
    expect(osThreatLevel(advanceOneWeek(g, 0.5, true))).toBe(0);       // untouched while away
  });

  it("over-exposure drags reputation in live play", () => {
    const sold = [soldPhone(50, 20_000_000)];
    const exposed = unlockPlatform({ ...newGame(7), launched: sold, osThreat: 95, osSecurity: 0, reputation: 60, era: 1 } as GameState, true);
    expect(advanceOneWeek(exposed).reputation).toBeLessThan(60);
  });

  it("a full OS version release wipes threat and hardens more than a single patch", () => {
    const g = unlockPlatform({ ...newGame(1), researched: { software: 3 }, osVersion: 1, osThreat: 80, osSecurity: 10 } as GameState, true);
    const after = releaseOsVersion(g);
    expect(osThreatLevel(after)).toBe(0);
    expect(osSecurityRating(after)).toBe(10 + BALANCE.platform.security.releaseSecurityGain);
    expect(after.lastPatchWeek).toBe(g.week);
  });

  it("a locked (base-game) tick never accrues apps, threat or security — determinism preserved", () => {
    const locked = advanceOneWeek({ ...newGame(7), platformUnlocked: false });
    expect(locked.osApps ?? 0).toBe(0);
    expect(locked.osThreat ?? 0).toBe(0);
    expect(locked.osSecurity ?? 0).toBe(0);
  });
});

describe("inbound licensing contracts", () => {
  it("signing banks the bonus, adds a licensee + exclusivity; declining clears; exclusive bills more", () => {
    const base = unlockPlatform({ ...newGame(7), cash: ZERO } as GameState, true);
    const rid = base.competitors[0].id;
    const mkOffer = (exclusive: boolean) => ({
      id: "lo-10", rivalId: rid, rivalName: base.competitors[0].name, category: "phone" as const,
      exclusive, signingBonus: dollars(120_000), royaltyPerWeek: dollars(3_000), termWeeks: 52, expiresWeek: 13, week: 10,
    });

    // Sign an EXCLUSIVE deal.
    const signed = signLicenseOffer({ ...base, pendingLicenseOffer: mkOffer(true) } as GameState);
    expect(signed.ok).toBe(true);
    expect(signed.state.cash).toBe(dollars(120_000));           // upfront bonus banked
    expect(signed.state.osLicensees).toContain(rid);            // now a licensee
    expect(signed.state.osExclusive?.[rid]).toBe("phone");      // exclusivity recorded
    expect(signed.state.pendingLicenseOffer).toBeNull();

    // The exclusive licensee bills a richer royalty than a plain one.
    const plain = signLicenseOffer({ ...base, pendingLicenseOffer: mkOffer(false) } as GameState).state;
    expect(toDollars(weeklyLicenseFees(signed.state))).toBeGreaterThan(toDollars(weeklyLicenseFees(plain)));

    // No offer → no-op; decline clears the offer with no charge.
    expect(signLicenseOffer(base).ok).toBe(false);
    const declined = declineLicenseOffer({ ...base, pendingLicenseOffer: mkOffer(false) } as GameState);
    expect(declined.ok).toBe(true);
    expect(declined.state.pendingLicenseOffer).toBeNull();
    expect(declined.state.cash).toBe(ZERO); // walking away costs nothing
  });

  it("negotiating applies the deterministic outcome and is a one-shot per offer", () => {
    const base = unlockPlatform({ ...newGame(7), cash: ZERO } as GameState, true);
    const rid = base.competitors[0].id;
    const offer = {
      id: "lo-5", rivalId: rid, rivalName: base.competitors[0].name, category: "phone" as const,
      exclusive: false, signingBonus: dollars(100_000), royaltyPerWeek: dollars(3_000),
      termWeeks: 52, expiresWeek: 8, week: 5, temper: "eager" as const, negotiated: false,
    };

    // No offer / locked → no-op.
    expect(negotiateLicenseOffer(base).ok).toBe(false);
    // An already-pushed offer can't be pushed again.
    expect(negotiateLicenseOffer({ ...base, pendingLicenseOffer: { ...offer, negotiated: true } } as GameState).ok).toBe(false);

    // A fresh push applies whatever the engine decided.
    const res = negotiateLicenseOffer({ ...base, pendingLicenseOffer: offer } as GameState);
    expect(res.ok).toBe(true);
    expect(["improved", "firm", "walked"]).toContain(res.negotiationOutcome);
    if (res.negotiationOutcome === "walked") {
      expect(res.state.pendingLicenseOffer).toBeNull(); // suitor pulled the deal
    } else {
      expect(res.state.pendingLicenseOffer?.negotiated).toBe(true); // now spent
      if (res.negotiationOutcome === "improved") {
        expect(res.state.pendingLicenseOffer!.signingBonus).toBeGreaterThan(dollars(100_000));
        expect(res.negotiationBonusDelta as number).toBeGreaterThan(0);
      }
      // One-shot: the follow-up push is rejected.
      expect(negotiateLicenseOffer(res.state).ok).toBe(false);
    }
  });
});
