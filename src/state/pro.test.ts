// Entitlement tests. Every case below maps to a way real money gets lost — either a paying customer
// locked out of what they bought, or Pro handed out free forever. The expiry helper is pure and
// takes an injected clock, so none of this depends on wall time.
import { describe, expect, it, beforeEach } from "vitest";
import {
  FIRST_FREE_BUILD,
  FREE_TRIAL_DAYS,
  PRO_PRODUCTS,
  clearProRecord,
  getProRecord,
  grantFounding,
  isFoundingBuild,
  isOnTrial,
  isPro,
  isRecordExpired,
  proProduct,
  proRecordFrom,
  proStatusLine,
  setProRecord,
  trialDaysRemaining,
  type ProRecord,
} from "./pro.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);

function rec(over: Partial<ProRecord> = {}): ProRecord {
  return {
    tier: "monthly",
    productId: "com.wrexist.silicon.pro.monthly",
    expiresAt: new Date(NOW + 10 * DAY).toISOString(),
    grantedAt: new Date(NOW - 20 * DAY).toISOString(),
    isTrial: false,
    willRenew: true,
    inGracePeriod: false,
    ...over,
  };
}

/** Same in-memory localStorage stub the other state tests use (Vitest runs in node). */
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
  clearProRecord();
});

describe("catalog", () => {
  it("exposes exactly one product per tier, all under the same bundle prefix", () => {
    const tiers = PRO_PRODUCTS.map((p) => p.tier).sort();
    expect(tiers).toEqual(["lifetime", "monthly", "yearly"]);
    for (const p of PRO_PRODUCTS) expect(p.id.startsWith("com.wrexist.silicon.pro.")).toBe(true);
  });

  it("marks only the recurring plans as trial-bearing — a one-time purchase has no trial to offer", () => {
    for (const p of PRO_PRODUCTS) expect(p.hasTrial).toBe(p.recurring);
  });

  it("gives every plan a length label, which Apple requires beside the price", () => {
    for (const p of PRO_PRODUCTS) expect(p.lengthLabel.trim().length).toBeGreaterThan(0);
  });

  it("resolves products by id and returns undefined for anything else", () => {
    expect(proProduct("com.wrexist.silicon.pro.yearly")?.tier).toBe("yearly");
    expect(proProduct("com.wrexist.silicon.sandbox")).toBeUndefined();
  });
});

describe("isRecordExpired", () => {
  it("honours a future expiry", () => {
    expect(isRecordExpired(rec(), NOW)).toBe(false);
  });

  it("expires a past expiry", () => {
    expect(isRecordExpired(rec({ expiresAt: new Date(NOW - DAY).toISOString() }), NOW)).toBe(true);
  });

  it("treats an UNPARSEABLE expiry as expired", () => {
    // `new Date("nonsense") < new Date()` is false (NaN), so without the explicit guard a corrupted
    // record would grant Pro permanently.
    expect(isRecordExpired(rec({ expiresAt: "not-a-date" }), NOW)).toBe(true);
  });

  it("does NOT treat a missing expiry as lifetime for a recurring tier", () => {
    // The single most expensive bug in subscription code: one paid month becoming Pro forever.
    const dateless = rec({ expiresAt: null, grantedAt: new Date(NOW - 400 * DAY).toISOString() });
    expect(isRecordExpired(dateless, NOW)).toBe(true);
  });

  it("still trusts a dateless recurring record inside its bounded offline window", () => {
    // A real subscriber offline for two weeks must keep what they pay for.
    const fresh = rec({ expiresAt: null, grantedAt: new Date(NOW - 14 * DAY).toISOString() });
    expect(isRecordExpired(fresh, NOW)).toBe(false);
  });

  it("gives the yearly tier a year-long offline window, not a month", () => {
    const yearly = rec({ tier: "yearly", expiresAt: null, grantedAt: new Date(NOW - 200 * DAY).toISOString() });
    expect(isRecordExpired(yearly, NOW)).toBe(false);
    const stale = rec({ tier: "yearly", expiresAt: null, grantedAt: new Date(NOW - 400 * DAY).toISOString() });
    expect(isRecordExpired(stale, NOW)).toBe(true);
  });

  it("expires a dateless record with no usable anchor at all", () => {
    expect(isRecordExpired(rec({ expiresAt: null, grantedAt: "" }), NOW)).toBe(true);
    expect(isRecordExpired(rec({ expiresAt: null, grantedAt: "garbage" }), NOW)).toBe(true);
  });

  it("never expires lifetime or founding, by IDENTITY rather than by a missing date", () => {
    const long = new Date(NOW - 9999 * DAY).toISOString();
    expect(isRecordExpired(rec({ tier: "lifetime", expiresAt: null, grantedAt: long }), NOW)).toBe(false);
    expect(isRecordExpired(rec({ tier: "founding", expiresAt: null, grantedAt: long }), NOW)).toBe(false);
    // …and a stale date on a lifetime record cannot revoke it either.
    expect(isRecordExpired(rec({ tier: "lifetime", expiresAt: new Date(NOW - DAY).toISOString() }), NOW)).toBe(false);
  });
});

describe("persistence", () => {
  it("round-trips a record", () => {
    const r = rec();
    setProRecord(r);
    expect(getProRecord()).toEqual(r);
    expect(isPro(NOW)).toBe(true);
  });

  it("reads no record as no Pro", () => {
    expect(getProRecord()).toBeNull();
    expect(isPro(NOW)).toBe(false);
  });

  it("fails CLOSED on a corrupted record rather than granting Pro", () => {
    localStorage.setItem("silicon.pro.v1", "{not json");
    expect(getProRecord()).toBeNull();
    expect(isPro(NOW)).toBe(false);
  });

  it("rejects a hand-forged record with an unknown tier", () => {
    localStorage.setItem("silicon.pro.v1", JSON.stringify({ tier: "god-mode", expiresAt: null }));
    expect(getProRecord()).toBeNull();
    expect(isPro(NOW)).toBe(false);
  });

  it("defaults a partial record's flags conservatively", () => {
    localStorage.setItem("silicon.pro.v1", JSON.stringify({ tier: "monthly" }));
    const got = getProRecord();
    expect(got).not.toBeNull();
    expect(got!.isTrial).toBe(false);
    expect(got!.inGracePeriod).toBe(false);
    expect(got!.willRenew).toBe(true);
    // No expiry and no anchor → expired, so the forged record grants nothing.
    expect(isPro(NOW)).toBe(false);
  });
});

describe("trial", () => {
  it("reports days remaining, rounded up", () => {
    setProRecord(rec({ isTrial: true, expiresAt: new Date(NOW + 2.2 * DAY).toISOString() }));
    expect(isOnTrial(NOW)).toBe(true);
    expect(trialDaysRemaining(NOW)).toBe(3);
  });

  it("reports zero once the trial has lapsed, and no Pro with it", () => {
    setProRecord(rec({ isTrial: true, expiresAt: new Date(NOW - DAY).toISOString() }));
    expect(isOnTrial(NOW)).toBe(false);
    expect(trialDaysRemaining(NOW)).toBe(0);
    expect(isPro(NOW)).toBe(false);
  });

  it("is not on a trial when the record isn't flagged as one", () => {
    setProRecord(rec());
    expect(isOnTrial(NOW)).toBe(false);
    expect(trialDaysRemaining(NOW)).toBe(0);
  });

  it("keeps the advertised trial length a positive whole number of days", () => {
    // Paywall copy quotes this; it must match the App Store Connect introductory offer.
    expect(Number.isInteger(FREE_TRIAL_DAYS)).toBe(true);
    expect(FREE_TRIAL_DAYS).toBeGreaterThan(0);
  });
});

describe("grandfathering", () => {
  it("recognises paid-era builds and only those", () => {
    expect(isFoundingBuild(1)).toBe(true);
    expect(isFoundingBuild(FIRST_FREE_BUILD - 1)).toBe(true);
    expect(isFoundingBuild(FIRST_FREE_BUILD)).toBe(false);
    expect(isFoundingBuild(FIRST_FREE_BUILD + 10)).toBe(false);
  });

  it("rejects junk rather than guessing", () => {
    expect(isFoundingBuild(undefined)).toBe(false);
    expect(isFoundingBuild(null)).toBe(false);
    expect(isFoundingBuild(0)).toBe(false);
    expect(isFoundingBuild(NaN)).toBe(false);
  });

  it("grants a permanent record", () => {
    grantFounding(NOW);
    expect(getProRecord()?.tier).toBe("founding");
    // Still Pro a decade later.
    expect(isPro(NOW + 3650 * DAY)).toBe(true);
  });

  it("never downgrades an existing permanent record", () => {
    setProRecord(proRecordFrom({ tier: "lifetime", productId: "com.wrexist.silicon.pro.lifetime" }, NOW));
    grantFounding(NOW);
    expect(getProRecord()?.tier).toBe("lifetime");
  });

  it("upgrades a lapsing subscription to permanent", () => {
    setProRecord(rec());
    grantFounding(NOW);
    expect(getProRecord()?.tier).toBe("founding");
  });

  it("keeps the first free build above every paid build that shipped", () => {
    // The paid era shipped builds 1–4. Lowering this constant silently strips Pro from customers
    // who paid for the app; raising it hands Pro to free downloads.
    expect(FIRST_FREE_BUILD).toBeGreaterThanOrEqual(5);
  });
});

describe("proStatusLine", () => {
  it("says so plainly when there is nothing", () => {
    expect(proStatusLine(NOW)).toBe("Not subscribed");
  });

  it("thanks Founding Owners", () => {
    grantFounding(NOW);
    expect(proStatusLine(NOW)).toContain("Founding Owner");
  });

  it("surfaces a billing problem instead of hiding it", () => {
    setProRecord(rec({ inGracePeriod: true }));
    expect(proStatusLine(NOW)).toContain("billing problem");
  });

  it("says cancelled — but still active — when the user has turned off renewal", () => {
    setProRecord(rec({ willRenew: false }));
    expect(proStatusLine(NOW)).toContain("cancelled");
  });

  it("counts down an active trial", () => {
    setProRecord(rec({ isTrial: true, expiresAt: new Date(NOW + 3 * DAY).toISOString() }));
    expect(proStatusLine(NOW)).toContain("Free trial");
  });
});
