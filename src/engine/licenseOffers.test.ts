import { describe, it, expect } from "vitest";
import { generateLicenseOffer, licenseOfferDue, licenseSigningBonus, type LicenseSuitor } from "./licenseOffers.ts";
import { toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";

const SUITORS: LicenseSuitor[] = [
  { id: "pomelo", name: "Pomelo", reputation: 72, category: "phone" },
  { id: "zenith", name: "Zenith", reputation: 61, category: "laptop" },
  { id: "novaplus", name: "NovaPlus", reputation: 46, category: "phone" },
];

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
});
