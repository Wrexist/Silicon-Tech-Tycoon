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

  it("writes a lifetime record when the store says the device owns it", async () => {
    bridge.isOwned.mockResolvedValue({ owned: true });
    await syncPro();
    expect(getProRecord()?.tier).toBe("lifetime");
  });

  it("writes an active subscription with its real expiry, trial flag and renewal flag", async () => {
    bridge.subscriptionStatus.mockResolvedValue({
      active: true,
      productId: "com.wrexist.silicon.pro.yearly",
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
      productId: "com.wrexist.silicon.pro.monthly",
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
    setProRecord(proRecordFrom({ tier: "monthly", productId: "com.wrexist.silicon.pro.monthly", expiresAt: YEAR_AHEAD }));
    const answered = await syncPro();
    expect(answered).toBe(true);
    expect(getProRecord()).toBeNull();
  });

  it("does NOT revoke when the subscription read fails, even if lifetime answered no", async () => {
    // The exact partial-read shape that would log a paying subscriber out on a flaky connection.
    setProRecord(proRecordFrom({ tier: "monthly", productId: "com.wrexist.silicon.pro.monthly", expiresAt: YEAR_AHEAD }));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    const answered = await syncPro();
    expect(answered).toBe(false);
    expect(isPro()).toBe(true);
  });

  it("does NOT revoke when the lifetime read fails, even if the subscription answered no", async () => {
    setProRecord(proRecordFrom({ tier: "lifetime", productId: "com.wrexist.silicon.pro.lifetime" }));
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    await syncPro();
    expect(isPro()).toBe(true);
  });

  it("does NOT revoke when the whole bridge is unreachable", async () => {
    setProRecord(proRecordFrom({ tier: "yearly", productId: "com.wrexist.silicon.pro.yearly", expiresAt: YEAR_AHEAD }));
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
    setProRecord(proRecordFrom({ tier: "monthly", productId: "com.wrexist.silicon.pro.monthly", expiresAt: YEAR_AHEAD }));
    expect(await syncPro()).toBe(false);
    expect(isPro()).toBe(true);
  });
});

describe("purchasePro", () => {
  it("grants on a confirmed store success", async () => {
    bridge.purchase.mockResolvedValue({ status: "purchased" });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: "com.wrexist.silicon.pro.yearly", expiresAt: YEAR_AHEAD,
    });
    const res = await purchasePro("com.wrexist.silicon.pro.yearly");
    expect(res.status).toBe("purchased");
    expect(isPro()).toBe(true);
  });

  it("still entitles the buyer when the post-purchase status read fails", async () => {
    // They were charged. A failed follow-up read must never leave them with nothing — the
    // conservative dateless record is trusted for a bounded window and corrected on the next sync.
    bridge.purchase.mockResolvedValue({ status: "purchased" });
    bridge.isOwned.mockRejectedValue(new Error("offline"));
    bridge.subscriptionStatus.mockRejectedValue(new Error("offline"));
    const res = await purchasePro("com.wrexist.silicon.pro.monthly");
    expect(res.status).toBe("purchased");
    expect(isPro()).toBe(true);
  });

  it("grants NOTHING on a cancel", async () => {
    bridge.purchase.mockResolvedValue({ status: "cancelled" });
    const res = await purchasePro("com.wrexist.silicon.pro.monthly");
    expect(res.status).toBe("cancelled");
    expect(isPro()).toBe(false);
  });

  it("grants NOTHING while a purchase is pending approval", async () => {
    bridge.purchase.mockResolvedValue({ status: "pending" });
    const res = await purchasePro("com.wrexist.silicon.pro.monthly");
    expect(res.status).toBe("pending");
    expect(isPro()).toBe(false);
  });

  it("grants NOTHING when the bridge throws", async () => {
    bridge.purchase.mockRejectedValue(new Error("boom"));
    const res = await purchasePro("com.wrexist.silicon.pro.monthly");
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
  it("only offers rows the store confirmed it can sell", async () => {
    bridge.getProducts.mockResolvedValue({
      products: [
        { id: "com.wrexist.silicon.pro.yearly", price: "kr 199", introEligible: true, introPeriod: "7 days" },
      ],
    });
    const cat = await getProCatalog();
    expect(cat.state).toBe("ready");
    expect(cat.offers.map((o) => o.id)).toEqual(["com.wrexist.silicon.pro.yearly"]);
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
      products: [{ id: "com.wrexist.silicon.pro.monthly", price: "$3.99", introEligible: false }],
    });
    const cat = await getProCatalog();
    expect(cat.offers[0].trialEligible).toBe(false);
  });

  it("never claims a trial on the one-time lifetime product", async () => {
    bridge.getProducts.mockResolvedValue({
      products: [{ id: "com.wrexist.silicon.pro.lifetime", price: "$29.99", introEligible: true }],
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
  it("recovers an active subscription that this device had no record of", async () => {
    bridge.restore.mockResolvedValue({ restored: true, owned: [] });
    bridge.subscriptionStatus.mockResolvedValue({
      active: true, productId: "com.wrexist.silicon.pro.monthly", expiresAt: YEAR_AHEAD,
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
