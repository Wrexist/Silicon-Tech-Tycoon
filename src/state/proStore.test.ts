// Store-sync semantics — the rules that decide when Pro is granted and, far more dangerously, when
// it is taken away. The native bridge is mocked so every failure mode a real device produces
// (offline, partial reads, an old OS, a store that answers "nothing") can be reproduced exactly.
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

// The native mirror is a fire-and-forget Capacitor call; stub it out of the unit under test.
vi.mock("./nativeStore.ts", () => ({ mirrorToNative: () => {}, hydrateFromNative: async () => {} }));

import { getProRecord, grantFounding, isPro, proRecordFrom, setProRecord } from "./pro.ts";
import { hasSandboxEntitlement } from "./entitlements.ts";
import { getProCatalog, purchasePro, restorePro, syncPro } from "./proStore.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

const YEAR_AHEAD = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString();

/** The default happy-path device: no paid-era purchase, no lifetime, no subscription. */
function quietStore() {
  bridge.originalPurchase.mockResolvedValue({});
  bridge.isOwned.mockResolvedValue({ owned: false });
  bridge.subscriptionStatus.mockResolvedValue({ active: false });
}

beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
  bridge.native = true;
  vi.clearAllMocks();
  quietStore();
});

afterEach(() => {
  bridge.native = true;
  vi.unstubAllGlobals();
});

describe("syncPro — granting", () => {
  it("grants permanent Pro to a paid-era buyer", async () => {
    bridge.originalPurchase.mockResolvedValue({ originalBuild: 4, originalVersion: "4" });
    await syncPro();
    expect(getProRecord()?.tier).toBe("founding");
    expect(isPro()).toBe(true);
  });

  it("does NOT grant founding to someone who downloaded the free build", async () => {
    bridge.originalPurchase.mockResolvedValue({ originalBuild: 12 });
    await syncPro();
    expect(getProRecord()).toBeNull();
  });

  it("parses a dotted original version defensively", async () => {
    bridge.originalPurchase.mockResolvedValue({ originalBuild: 1, originalVersion: "1.2.0" });
    await syncPro();
    expect(getProRecord()?.tier).toBe("founding");
  });

  it("never grants founding from a version string alone", async () => {
    // The sandbox shape. `AppTransaction.originalAppVersion` reports "1.0" for EVERY sandbox and
    // TestFlight install regardless of what was really bought, so the native side deliberately
    // withholds `originalBuild` outside production and sends only the diagnostic string. If this
    // ever starts granting, every tester — and anyone who can fake the version — gets Pro free.
    bridge.originalPurchase.mockResolvedValue({ originalVersion: "1.0" });
    await syncPro();
    expect(getProRecord()).toBeNull();
    expect(isPro()).toBe(false);
  });

  it("writes a lifetime record when the store says the device owns it", async () => {
    bridge.isOwned.mockResolvedValue({ owned: true });
    await syncPro();
    expect(getProRecord()?.tier).toBe("lifetime");
  });

  it("writes an active subscription with its real expiry, trial flag and renewal flag", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: "com.wrexist.silicon.pro.yearly.premium",
      expiresAt: YEAR_AHEAD,
      isTrial: true,
      willRenew: false,
      inGracePeriod: false,
    });
    await syncPro();
    const rec = getProRecord()!;
    expect(rec.tier).toBe("yearly");
    expect(rec.expiresAt).toBe(YEAR_AHEAD);
    expect(rec.isTrial).toBe(true);
    expect(rec.willRenew).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("keeps a grace-period subscriber entitled — Apple is still retrying their payment", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: "com.wrexist.silicon.pro.weekly",
      expiresAt: YEAR_AHEAD,
      inGracePeriod: true,
    });
    await syncPro();
    expect(isPro()).toBe(true);
    expect(getProRecord()?.inGracePeriod).toBe(true);
  });
});

describe("syncPro — revoking (the dangerous direction)", () => {
  it("clears the record only when BOTH sources definitively answered no", async () => {
    setProRecord(proRecordFrom({ tier: "weekly", productId: "com.wrexist.silicon.pro.weekly", expiresAt: YEAR_AHEAD }));
    const answered = await syncPro();
    expect(answered).toBe(true);
    expect(getProRecord()).toBeNull();
  });

  it("does NOT revoke when the subscription read fails, even if lifetime answered no", async () => {
    // The exact partial-read shape that would log a paying subscriber out on a flaky connection.
    setProRecord(proRecordFrom({ tier: "weekly", productId: "com.wrexist.silicon.pro.weekly", expiresAt: YEAR_AHEAD }));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    const answered = await syncPro();
    expect(answered).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("does NOT revoke when the lifetime read fails, even if the subscription answered no", async () => {
    setProRecord(proRecordFrom({ tier: "lifetime", productId: "com.wrexist.silicon.pro.lifetime.premium" }));
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    await syncPro();
    expect(isPro()).toBe(true);
  });

  it("does NOT revoke when the whole bridge is unreachable", async () => {
    setProRecord(proRecordFrom({ tier: "yearly", productId: "com.wrexist.silicon.pro.yearly.premium", expiresAt: YEAR_AHEAD }));
    bridge.originalPurchase.mockRejectedValue(new Error("no bridge"));
    bridge.isOwned.mockRejectedValue(new Error("no bridge"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("no bridge"));
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("never revokes a Founding Owner, even on a clean 'you own nothing' answer", async () => {
    // iOS < 16 can't re-derive founding status, so a definitive "no purchases" must not strip it.
    grantFounding();
    await syncPro();
    expect(getProRecord()?.tier).toBe("founding");
    expect(isPro()).toBe(true);
  });

  it("is inert off-device — the web preview never touches a real entitlement", async () => {
    bridge.native = false;
    setProRecord(proRecordFrom({ tier: "weekly", productId: "com.wrexist.silicon.pro.weekly", expiresAt: YEAR_AHEAD }));
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });
});

describe("purchasePro", () => {
  it("grants on a confirmed store success", async () => {
    bridge.purchase.mockResolvedValue({ status: "purchased" });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: "com.wrexist.silicon.pro.yearly.premium", expiresAt: YEAR_AHEAD,
    });
    const res = await purchasePro("com.wrexist.silicon.pro.yearly.premium");
    expect(res.status).toBe("purchased");
    expect(isPro()).toBe(true);
  });

  it("still entitles the buyer when the post-purchase status read fails", async () => {
    // They were charged. A failed follow-up read must never leave them with nothing — the
    // conservative dateless record is trusted for a bounded window and corrected on the next sync.
    bridge.purchase.mockResolvedValue({ status: "purchased" });
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    const res = await purchasePro("com.wrexist.silicon.pro.weekly");
    expect(res.status).toBe("purchased");
    expect(isPro()).toBe(true);
  });

  it("grants NOTHING on a cancel", async () => {
    bridge.purchase.mockResolvedValue({ status: "cancelled" });
    const res = await purchasePro("com.wrexist.silicon.pro.weekly");
    expect(res.status).toBe("cancelled");
    expect(isPro()).toBe(false);
  });

  it("grants NOTHING while a purchase is pending approval", async () => {
    bridge.purchase.mockResolvedValue({ status: "pending" });
    const res = await purchasePro("com.wrexist.silicon.pro.weekly");
    expect(res.status).toBe("pending");
    expect(isPro()).toBe(false);
  });

  it("grants NOTHING when the bridge throws", async () => {
    bridge.purchase.mockRejectedValue(new Error("boom"));
    const res = await purchasePro("com.wrexist.silicon.pro.weekly");
    expect(res.status).toBe("error");
    expect(isPro()).toBe(false);
  });

  it("refuses an unknown product id outright", async () => {
    const res = await purchasePro("com.wrexist.silicon.pro.free-please");
    expect(res.status).toBe("unavailable");
    expect(bridge.purchase).not.toHaveBeenCalled();
  });
});

describe("getProCatalog", () => {
  it("never substitutes a US price for missing native storefront pricing", async () => {
    bridge.getProducts.mockResolvedValue({ products: [
      { id: "com.wrexist.silicon.pro.yearly.premium", price: "  " },
      { id: "com.wrexist.silicon.pro.weekly" },
      { id: "com.wrexist.silicon.pro.lifetime.premium", price: "299 kr" },
    ] });
    const catalog = await getProCatalog();
    expect(catalog.offers.map(({ id, price }) => ({ id, price }))).toEqual([
      { id: "com.wrexist.silicon.pro.lifetime.premium", price: "299 kr" },
    ]);
  });

  it("only offers rows the store confirmed it can sell", async () => {
    bridge.getProducts.mockResolvedValue({
      products: [
        { id: "com.wrexist.silicon.pro.yearly.premium", price: "kr 199", introEligible: true, introPeriod: "7 days" },
      ],
    });
    const cat = await getProCatalog();
    expect(cat.state).toBe("ready");
    expect(cat.offers.map((o) => o.id)).toEqual(["com.wrexist.silicon.pro.yearly.premium"]);
    // Localized price, never our USD fallback.
    expect(cat.offers[0].price).toBe("kr 199");
  });

  it("reports unavailable when the store returns nothing, so no dead CTA is rendered", async () => {
    bridge.getProducts.mockResolvedValue({ products: [] });
    expect((await getProCatalog()).state).toBe("unavailable");
  });

  it("reports unavailable when the store throws", async () => {
    bridge.getProducts.mockRejectedValue(new Error("offline"));
    expect((await getProCatalog()).state).toBe("unavailable");
  });

  it("hides trial framing from an Apple ID the store says is ineligible", async () => {
    // Promising a trial the store won't honour is a false claim on the paywall.
    bridge.getProducts.mockResolvedValue({
      products: [{ id: "com.wrexist.silicon.pro.weekly", price: "$3.99", introEligible: false }],
    });
    const cat = await getProCatalog();
    expect(cat.offers[0].trialEligible).toBe(false);
  });

  it("never claims a trial on the one-time lifetime product", async () => {
    bridge.getProducts.mockResolvedValue({
      products: [{ id: "com.wrexist.silicon.pro.lifetime.premium", price: "$29.99", introEligible: true }],
    });
    const cat = await getProCatalog();
    expect(cat.offers[0].trialEligible).toBe(false);
  });

  it("falls back to the full USD catalog off-device so the funnel stays testable in a browser", async () => {
    bridge.native = false;
    const cat = await getProCatalog();
    expect(cat.fromStore).toBe(false);
    expect(cat.offers.length).toBe(3);
  });
});

describe("restorePro", () => {
  it("restores the legacy Creative purchase without granting full Pro", async () => {
    bridge.restore.mockResolvedValue({ restored: true, owned: ["com.wrexist.silicon.sandbox"] });
    expect(await restorePro()).toEqual({ restored: false, creativeRestored: true });
    expect(hasSandboxEntitlement()).toBe(true);
    expect(isPro()).toBe(false);
  });

  it("reports a retryable error when restore and entitlement reads fail", async () => {
    bridge.restore.mockRejectedValue(new Error("offline"));
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    await expect(restorePro()).rejects.toThrow("Couldn't reach the App Store");
    expect(isPro()).toBe(false);
  });

  it("does not claim there are no purchases after a cancelled store refresh", async () => {
    bridge.restore.mockRejectedValue(new Error("sign-in cancelled"));
    await expect(restorePro()).rejects.toThrow("Couldn't reach the App Store");
  });

  it("requires a conclusive entitlement read after a successful restore", async () => {
    bridge.restore.mockResolvedValue({ restored: true, owned: [] });
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    await expect(restorePro()).rejects.toThrow("Couldn't reach the App Store");
  });

  it("recovers an active subscription that this device had no record of", async () => {
    bridge.restore.mockResolvedValue({ restored: true, owned: [] });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: "com.wrexist.silicon.pro.weekly", expiresAt: YEAR_AHEAD,
    });
    expect((await restorePro()).restored).toBe(true);
    expect(isPro()).toBe(true);
  });

  it("reports honestly when there is genuinely nothing to restore", async () => {
    bridge.restore.mockResolvedValue({ restored: false, owned: [] });
    expect((await restorePro()).restored).toBe(false);
  });

  it("still syncs when the restore call itself throws", async () => {
    bridge.restore.mockRejectedValue(new Error("sign-in cancelled"));
    bridge.isOwned.mockResolvedValue({ owned: true });
    expect((await restorePro()).restored).toBe(true);
  });
});


describe("price experiment and legacy access", () => {
  it("previews the value ladder only on the development web path", async () => {
    bridge.native = false;
    vi.stubGlobal("window", { location: { search: "?pricePreview=B" } });
    const catalog = await getProCatalog();
    expect(catalog.fromStore).toBe(false);
    expect(catalog.offers.map(o => o.price)).toEqual(["$59.99", "$119.99", "$4.99"]);
    expect(bridge.getProducts).not.toHaveBeenCalled();
  });
  it("never lets a preview URL override native store assignment", async () => {
    vi.stubGlobal("window", { location: { search: "?pricePreview=B" } });
    bridge.getProducts.mockResolvedValue({ products: [{ id: "com.wrexist.silicon.pro.weekly", price: "$7.99" }] });
    const catalog = await getProCatalog();
    expect(catalog.fromStore).toBe(true);
    expect(catalog.offers.map(o => o.id)).toEqual(["com.wrexist.silicon.pro.weekly"]);
  });
  it("retains a legacy monthly subscriber without offering monthly for sale", async () => {
    bridge.subscriptionStatus.mockResolvedValue({ active: true, productId: "com.wrexist.silicon.pro.monthly", expiresAt: YEAR_AHEAD });
    await syncPro();
    expect(getProRecord()?.tier).toBe("monthly");
    expect(isPro()).toBe(true);
    expect((await purchasePro("com.wrexist.silicon.pro.monthly")).status).toBe("unavailable");
  });
  it("restores either experiment lifetime product", async () => {
    bridge.isOwned.mockImplementation(async ({ productId }: { productId: string }) => ({ owned: productId === "com.wrexist.silicon.pro.lifetime.value" }));
    await syncPro();
    expect(getProRecord()?.productId).toBe("com.wrexist.silicon.pro.lifetime.value");
    expect(getProRecord()?.tier).toBe("lifetime");
  });
  it("keeps paid access if just one lifetime ownership read fails", async () => {
    setProRecord(proRecordFrom({ tier: "lifetime", productId: "com.wrexist.silicon.pro.lifetime.value" }));
    bridge.isOwned.mockImplementation(async ({ productId }: { productId: string }) => {
      if (productId.endsWith(".value")) throw new Error("offline");
      return { owned: false };
    });
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });
  it("returns the assigned value offer with its package attribution", async () => {
    bridge.getProducts.mockResolvedValue({ offeringId: "silicon_140_price_b", products: [
      { id: "com.wrexist.silicon.pro.weekly.value", price: "$4.99", offeringId: "silicon_140_price_b", packageId: "$rc_weekly", introEligible: true },
    ] });
    const c = await getProCatalog();
    expect(c.offeringId).toBe("silicon_140_price_b");
    expect(c.offers).toHaveLength(1);
    expect(c.offers[0].trialEligible).toBe(true);
    bridge.purchase.mockResolvedValue({ status: "cancelled" });
    await purchasePro(c.offers[0].id, c.offers[0]);
    expect(bridge.purchase).toHaveBeenCalledWith({ productId: c.offers[0].id, offeringId: "silicon_140_price_b", packageId: "$rc_weekly" });
  });
  it("refuses a mixed price ladder rather than combining cohorts", async () => {
    bridge.getProducts.mockResolvedValue({ products: [
      { id: "com.wrexist.silicon.pro.yearly.premium", price: "$99.99" },
      { id: "com.wrexist.silicon.pro.weekly.value", price: "$4.99" },
    ] });
    expect((await getProCatalog()).state).toBe("unavailable");
  });
});
