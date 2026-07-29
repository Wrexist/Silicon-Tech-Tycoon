// THE REVENUECAT ADAPTER CONTRACT.
//
// The RevenueCat mapping itself lives in Swift (`ios/App/App/SiliconStoreKit+RevenueCat.swift`) and
// cannot be executed here. What CAN be executed — and what actually protects the money — is the
// other half of the contract: given the exact bridge payloads a RevenueCat `CustomerInfo` produces,
// does the app still grant and revoke the right things?
//
// So each test below is named for the RevenueCat state it reproduces, and the fixture is the literal
// payload the Swift adapter is required to emit for that state. If someone changes the Swift mapping
// and these fixtures no longer describe reality, the fixtures are the spec and the Swift is the bug.
//
// This file exists in addition to `proStore.test.ts`, not instead of it: that suite pins the
// behaviour of the seam generally, this one pins the RevenueCat-shaped inputs specifically. Both had
// better stay green.
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

const bridge = vi.hoisted(() => ({
  native: true,
  originalPurchase: vi.fn(),
  isOwned: vi.fn(),
  subscriptionStatus: vi.fn(),
  getProducts: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
  manageSubscriptions: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("./storeKitBridge.ts", () => ({
  isNative: () => bridge.native,
  storeKit: () => bridge,
}));

vi.mock("./nativeStore.ts", () => ({ mirrorToNative: () => {}, hydrateFromNative: async () => {} }));

import { getProRecord, isPro, isOnTrial, proRecordFrom, setProRecord, proStatusLine } from "./pro.ts";
import { getProCatalog, purchasePro, restorePro, syncPro } from "./proStore.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

const MONTH_AHEAD = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const WEEK_AHEAD = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const YEARLY = "com.wrexist.silicon.pro.yearly";
const MONTHLY = "com.wrexist.silicon.pro.monthly";
const LIFETIME = "com.wrexist.silicon.pro.lifetime";

/** No entitlement, nothing owned — a brand-new free install as RevenueCat reports it. */
function noEntitlements() {
  bridge.originalPurchase.mockResolvedValue({});
  bridge.isOwned.mockResolvedValue({ owned: false });
  bridge.subscriptionStatus.mockResolvedValue({ active: false });
}

beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
  bridge.native = true;
  vi.clearAllMocks();
  noEntitlements();
});

afterEach(() => {
  bridge.native = true;
});

/* ───────────────────────────────  1. GRACE PERIOD  ─────────────────────────────── */

describe("RevenueCat: billing grace period", () => {
  // EntitlementInfo { isActive: true, billingIssueDetectedAt: <date>, expirationDate: <future> }
  // RevenueCat keeps the entitlement ACTIVE while Apple retries a failed payment, which is what this
  // app has always done. The user must not lose access — most of that churn is an expired card.
  it("keeps a grace-period subscriber fully entitled", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: MONTHLY,
      expiresAt: MONTH_AHEAD,
      isTrial: false,
      willRenew: true,
      inGracePeriod: true,
    });
    await syncPro();
    expect(isPro()).toBe(true);
    expect(getProRecord()?.inGracePeriod).toBe(true);
  });

  it("keeps grace period DISTINCT from a plain expiry, so the billing strip can't misfire", async () => {
    // The failure this guards: mapping `billingIssueDetectedAt != nil` without also requiring the
    // entitlement to be active. A lapsed subscriber whose last payment failed would then read as
    // "in grace period" forever and be shown a fix-your-card strip they can do nothing with.
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: MONTHLY,
      expiresAt: MONTH_AHEAD,
      inGracePeriod: false,
    });
    await syncPro();
    expect(getProRecord()?.inGracePeriod).toBe(false);
    expect(proStatusLine()).not.toContain("billing problem");
  });
});

/* ───────────────────────────────  2. TRIAL  ─────────────────────────────── */

describe("RevenueCat: introductory period", () => {
  // EntitlementInfo.periodType == .trial
  it("reports a free trial as a trial, with its real remaining days", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: YEARLY,
      expiresAt: WEEK_AHEAD,
      isTrial: true,
      willRenew: true,
    });
    await syncPro();
    expect(isOnTrial()).toBe(true);
    expect(proStatusLine()).toContain("Free trial");
  });

  // EntitlementInfo.periodType == .intro — a DISCOUNTED PAID period, not a free trial. The adapter
  // maps only `.trial` to `isTrial`, because "Free trial — 6 days left" on a paid intro is a false
  // claim on a purchase surface (Apple 3.1.2).
  it("does NOT call a paid introductory price a free trial", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: YEARLY,
      expiresAt: MONTH_AHEAD,
      isTrial: false,
      willRenew: true,
    });
    await syncPro();
    expect(isPro()).toBe(true);
    expect(isOnTrial()).toBe(false);
  });

  it("shows trial framing per ROW, never the selected plan's terms on every row", async () => {
    // checkTrialOrIntroDiscountEligibility is per product identifier. Yearly eligible, monthly not.
    bridge.getProducts.mockResolvedValue({
      products: [
        { id: YEARLY, price: "kr 199", introEligible: true, introPeriod: "7 days" },
        { id: MONTHLY, price: "kr 39", introEligible: false },
        { id: LIFETIME, price: "kr 299", owned: false },
      ],
    });
    const cat = await getProCatalog();
    const byId = Object.fromEntries(cat.offers.map((o) => [o.id, o]));
    expect(byId[YEARLY].trialEligible).toBe(true);
    expect(byId[MONTHLY].trialEligible).toBe(false);
    // Lifetime carries no trial at all, whatever the store says about eligibility.
    expect(byId[LIFETIME].trialEligible).toBe(false);
  });
});

/* ───────────────────────────────  3. LIFETIME  ─────────────────────────────── */

describe("RevenueCat: lifetime (a non-subscription purchase)", () => {
  // CustomerInfo.nonSubscriptions contains the lifetime product id, and the `pro` entitlement it
  // unlocks has NO expirationDate. Identified by IDENTITY, never by the missing date.
  it("grants lifetime from ownership, with no expiry, and never lets it lapse", async () => {
    bridge.isOwned.mockResolvedValue({ owned: true });
    await syncPro();
    const rec = getProRecord()!;
    expect(rec.tier).toBe("lifetime");
    expect(rec.expiresAt).toBeNull();
    // A year later it is still Pro. If "no expiry date" were ever read as "expired", every lifetime
    // purchase in the wild would die at once.
    expect(isPro(Date.now() + 400 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("does not let the subscription read describe a lifetime owner as a subscriber", async () => {
    // The adapter reports `active: false` from subscriptionStatus for a lifetime-only entitlement,
    // precisely so the (earlier) ownership branch is what writes the record. Reporting it as an
    // active subscription with no expiry is the shape that becomes an accidental permanent grant on
    // a tier that is supposed to be able to lapse.
    bridge.isOwned.mockResolvedValue({ owned: true });
    bridge.subscriptionStatus.mockResolvedValue({ active: false });
    await syncPro();
    expect(getProRecord()?.tier).toBe("lifetime");
  });
});

/* ───────────────────────────────  4. OFFLINE  ─────────────────────────────── */

describe("RevenueCat: offline", () => {
  // Purchases.shared.cachedCustomerInfo served the answer; the adapter must never fail closed.
  it("keeps an active subscriber entitled when the live read fails but the cache answers", async () => {
    setProRecord(proRecordFrom({ tier: "yearly", productId: YEARLY, expiresAt: MONTH_AHEAD }));
    bridge.isOwned.mockResolvedValue({ owned: false });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: YEARLY, expiresAt: MONTH_AHEAD, willRenew: true,
    });
    expect(await syncPro()).toBe(true);
    expect(isPro()).toBe(true);
  });

  it("an already-owned non-consumable tapped offline resolves purchased, not error", async () => {
    // The adapter short-circuits from cachedCustomerInfo BEFORE any network call. This was a real
    // bug once: an owned Lifetime tapped in airplane mode showed a purchase error.
    bridge.purchase.mockResolvedValue({ status: "purchased" });
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    const res = await purchasePro(LIFETIME);
    expect(res.status).toBe("purchased");
    expect(isPro()).toBe(true);
  });

  it("a cancel is never surfaced as an error, however RevenueCat reports it", async () => {
    // ErrorCode.purchaseCancelledError and the `userCancelled` flag both map to "cancelled".
    bridge.purchase.mockResolvedValue({ status: "cancelled" });
    const res = await purchasePro(MONTHLY);
    expect(res.status).toBe("cancelled");
    expect(res.message).toBeUndefined();
    expect(isPro()).toBe(false);
  });

  it("ErrorCode.paymentPendingError grants nothing and reads as pending", async () => {
    bridge.purchase.mockResolvedValue({ status: "pending", message: "Your purchase is pending approval." });
    const res = await purchasePro(MONTHLY);
    expect(res.status).toBe("pending");
    expect(isPro()).toBe(false);
  });
});

/* ───────────────────────────────  5. PARTIAL READS  ─────────────────────────────── */

describe("RevenueCat: an unanswerable read must REJECT, never answer 'no'", () => {
  // This is the single most expensive mapping decision in the adapter. `isOwned` and
  // `subscriptionStatus` are built on one `CustomerInfo` fetch; if that fetch fails and the adapter
  // resolved a negative instead of rejecting, both sources would "definitively" say no at once and
  // syncPro would revoke — logging out a paying customer on a bad train journey.
  it("does not revoke when the customer-info read throws", async () => {
    setProRecord(proRecordFrom({ tier: "monthly", productId: MONTHLY, expiresAt: MONTH_AHEAD }));
    bridge.isOwned.mockRejectedValue(new Error("network"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("network"));
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("does not revoke on a HALF-answered read", async () => {
    setProRecord(proRecordFrom({ tier: "yearly", productId: YEARLY, expiresAt: MONTH_AHEAD }));
    bridge.isOwned.mockResolvedValue({ owned: false });
    bridge.subscriptionStatus.mockRejectedValue(new Error("network"));
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("DOES revoke when RevenueCat genuinely reports no entitlement at all", async () => {
    // The other direction matters too: a real lapse must actually take Pro away, or the paywall
    // becomes decorative. Both sources answered, both said no.
    setProRecord(proRecordFrom({ tier: "monthly", productId: MONTHLY, expiresAt: MONTH_AHEAD }));
    expect(await syncPro()).toBe(true);
    expect(getProRecord()).toBeNull();
  });
});

/* ───────────────────────────────  6. SANDBOX / FOUNDING  ─────────────────────────────── */

describe("RevenueCat: founding-owner grandfathering is NOT delegated to the SDK", () => {
  // `originalPurchase()` deliberately stays on Apple's AppTransaction in both backends.
  // RevenueCat's CustomerInfo.originalApplicationVersion is the same receipt field with LESS
  // context: no revocationDate, and the identical sandbox hazard.
  it("still grants a paid-era owner from a production build number", async () => {
    bridge.originalPurchase.mockResolvedValue({ originalBuild: 4, originalVersion: "4" });
    await syncPro();
    expect(getProRecord()?.tier).toBe("founding");
  });

  it("grants NOTHING from the sandbox shape — the '1.0' that every tester reports", async () => {
    // THE trap. In sandbox and TestFlight the original-version field reads "1.0" no matter what was
    // installed. Parsed, that is build 1 — below FIRST_FREE_BUILD — so if a build number were ever
    // reported outside production, every tester would get permanent free Pro and the paywall could
    // never be tested on the builds that must test it. The native side withholds the number outside
    // production; this asserts the JS side grants nothing from the string alone.
    bridge.originalPurchase.mockResolvedValue({ originalVersion: "1.0" });
    await syncPro();
    expect(getProRecord()).toBeNull();
    expect(isPro()).toBe(false);
  });

  it("never revokes a founding owner once granted, whatever RevenueCat says", async () => {
    // Migration case: a device that was granted founding under the StoreKit build updates to the
    // RevenueCat build. RevenueCat knows nothing about that grant and reports no entitlement. The
    // record is permanent and locally held — it must survive.
    setProRecord(proRecordFrom({ tier: "founding", productId: "" }));
    await syncPro();
    expect(getProRecord()?.tier).toBe("founding");
    expect(isPro()).toBe(true);
  });
});

/* ───────────────────────────────  7. MIGRATION  ─────────────────────────────── */

describe("RevenueCat: the update from the StoreKit build", () => {
  it("a mid-subscription updater is never shown a paywall for what they already pay for", async () => {
    // They updated with a live record. Even before RevenueCat's first network call resolves, the
    // locally persisted record keeps them Pro — there is no frame in which they are locked out.
    setProRecord(proRecordFrom({ tier: "yearly", productId: YEARLY, expiresAt: MONTH_AHEAD }));
    expect(isPro()).toBe(true);
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: YEARLY, expiresAt: MONTH_AHEAD, willRenew: true,
    });
    await syncPro();
    expect(isPro()).toBe(true);
  });

  it("restore recovers a subscription bought before the migration", async () => {
    // RevenueCat's restorePurchases() reads the App Store receipt, which still carries every
    // pre-migration purchase — the user does nothing but tap Restore.
    bridge.restore.mockResolvedValue({ restored: true, owned: [YEARLY] });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: YEARLY, expiresAt: MONTH_AHEAD, willRenew: true,
    });
    expect((await restorePro()).restored).toBe(true);
    expect(getProRecord()?.tier).toBe("yearly");
  });

  it("restore recovers a lifetime bought before the migration", async () => {
    bridge.restore.mockResolvedValue({ restored: true, owned: [LIFETIME] });
    bridge.isOwned.mockResolvedValue({ owned: true });
    expect((await restorePro()).restored).toBe(true);
    expect(getProRecord()?.tier).toBe("lifetime");
  });

  it("a catalog RevenueCat could not load renders no buy button at all", async () => {
    // Offerings unreachable → no rows → the paywall shows an honest retry state. A CTA that can
    // only ever error is the App Review 2.1.0 rejection this probe exists to prevent.
    bridge.getProducts.mockResolvedValue({ products: [] });
    expect((await getProCatalog()).state).toBe("unavailable");
  });

  it("uses RevenueCat's localized price string verbatim, never a formatted one", async () => {
    bridge.getProducts.mockResolvedValue({
      products: [{ id: YEARLY, price: "¥3,000", introEligible: false }],
    });
    const cat = await getProCatalog();
    expect(cat.offers[0].price).toBe("¥3,000");
  });
});
