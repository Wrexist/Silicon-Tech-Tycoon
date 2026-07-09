import { describe, it, expect } from "vitest";
import {
  generateLicenseOffer, licenseOfferDue, licenseSigningBonus, suitorTemper, offerTemper,
  negotiateLicenseOffer, type LicenseSuitor, type LicenseOffer, type SuitorTemper,
} from "./licenseOffers.ts";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";

const SUITORS: LicenseSuitor[] = [
  { id: "pomelo", name: "Pomelo", reputation: 72, category: "phone" },
  { id: "zenith", name: "Zenith", reputation: 61, category: "laptop" },
  { id: "novaplus", name: "NovaPlus", reputation: 46, category: "phone" },
];

const mkOffer = (over: Partial<LicenseOffer> = {}): LicenseOffer => ({
  id: "lo-5", rivalId: "r", rivalName: "Rival", category: "phone", exclusive: false,
  signingBonus: dollars(100_000), royaltyPerWeek: dollars(3_000), termWeeks: 52,
  expiresWeek: 10, week: 5, temper: "eager", negotiated: false, ...over,
});

describe("inbound OS licensing contracts", () => {
  it("offers only appear once the OS is credible (tier ≥ minOsTier)", () => {
    const c = BALANCE.platform.contract;
    // Below the tier gate: never due, whatever the week.
    for (let w = 0; w < 60; w++) expect(licenseOfferDue(7, w, c.minOsTier - 1)).toBe(false);
    // At/above the gate: some weeks are due (the deterministic cadence fires).
    let due = 0;
    for (let w = 0; w < 120; w++) if (licenseOfferDue(7, w, c.minOsTier)) due++;
    expect(due).toBeGreaterThan(0);
  });

  it("generates a deterministic offer from the suitor pool", () => {
    const a = generateLicenseOffer(7, 40, 3, SUITORS);
    const b = generateLicenseOffer(7, 40, 3, SUITORS);
    expect(a).toEqual(b); // same seed/week/pool → identical
    expect(a).not.toBeNull();
    expect(SUITORS.some((s) => s.id === a!.rivalId)).toBe(true);
    expect(a!.expiresWeek).toBe(40 + BALANCE.platform.contract.lifeWeeks);
    expect(toDollars(a!.signingBonus)).toBeGreaterThan(0);
    // Empty pool → no offer.
    expect(generateLicenseOffer(7, 40, 3, [])).toBeNull();
  });

  it("an exclusive deal pays a premium signing bonus over a standard one", () => {
    const std = licenseSigningBonus(70, 3, false);
    const exc = licenseSigningBonus(70, 3, true);
    expect(toDollars(exc)).toBeGreaterThan(toDollars(std));
    // Bonus scales with reputation × tier, and is capped.
    expect(toDollars(licenseSigningBonus(90, 4, false))).toBeGreaterThan(toDollars(licenseSigningBonus(30, 2, false)));
    expect(toDollars(licenseSigningBonus(1e9, 9, true))).toBeLessThanOrEqual(BALANCE.platform.contract.signBonusCap);
  });

  it("generated offers carry a bargaining temper", () => {
    const off = generateLicenseOffer(7, 40, 3, SUITORS);
    expect(off).not.toBeNull();
    expect(["eager", "measured", "hardball"]).toContain(off!.temper);
  });
});

describe("contract negotiation", () => {
  it("reads proud / exclusivity-demanding suitors as hardball, humble ones as eager", () => {
    expect(suitorTemper(20, false)).toBe("eager");
    expect(suitorTemper(45, false)).toBe("measured");
    expect(suitorTemper(70, false)).toBe("hardball");
    expect(suitorTemper(20, true)).toBe("hardball"); // an exclusivity demand always plays hardball
    // offerTemper falls back sensibly for an offer with no stored temper.
    expect(offerTemper(mkOffer({ temper: undefined, exclusive: true }))).toBe("hardball");
    expect(offerTemper(mkOffer({ temper: undefined, exclusive: false }))).toBe("measured");
  });

  it("is deterministic per offer; improving lifts the bonus, firm/walk keep it", () => {
    const off = mkOffer({ week: 5, temper: "eager" });
    const a = negotiateLicenseOffer(7, off);
    expect(negotiateLicenseOffer(7, off)).toEqual(a); // same seed + offer → identical
    if (a.outcome === "improved") {
      expect(toDollars(a.signingBonus)).toBeGreaterThan(toDollars(off.signingBonus));
      expect(toDollars(a.bonusDelta)).toBeGreaterThan(0);
    } else {
      expect(a.signingBonus).toBe(off.signingBonus);
      expect(toDollars(a.bonusDelta)).toBe(0);
    }
  });

  it("eager suitors sweeten more and walk less than hardball ones; all outcomes occur", () => {
    const tally = (temper: SuitorTemper) => {
      let improved = 0, walked = 0, firm = 0;
      for (let w = 0; w < 400; w++) {
        const r = negotiateLicenseOffer(7, mkOffer({ week: w, temper }));
        if (r.outcome === "improved") improved++;
        else if (r.outcome === "walked") walked++;
        else firm++;
      }
      return { improved, walked, firm };
    };
    const eager = tally("eager");
    const hard = tally("hardball");
    // The full spread of outcomes shows up over many weeks.
    expect(eager.improved).toBeGreaterThan(0);
    expect(eager.walked).toBeGreaterThan(0);
    expect(eager.firm).toBeGreaterThan(0);
    // Temper matters: eager suitors improve more and walk less than hardball ones.
    expect(eager.improved).toBeGreaterThan(hard.improved);
    expect(eager.walked).toBeLessThan(hard.walked);
  });

  it("an improved bonus is still bounded by the signing-bonus cap", () => {
    const cap = BALANCE.platform.contract.signBonusCap;
    for (let w = 0; w < 200; w++) {
      const r = negotiateLicenseOffer(7, mkOffer({ week: w, temper: "eager", signingBonus: dollars(cap) }));
      expect(toDollars(r.signingBonus)).toBeLessThanOrEqual(cap);
    }
  });
});
