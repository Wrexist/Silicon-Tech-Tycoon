import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import {
  hasSandboxEntitlement,
  grantSandboxEntitlement,
  clearSandboxEntitlement,
} from "./entitlements.ts";
import {
  getSandboxProduct,
  iapAvailable,
  purchaseSandbox,
  restoreSandbox,
  SANDBOX_PRODUCT_ID,
} from "./iap.ts";

// node env has no DOM — stub localStorage so entitlements persist within a test.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
}

beforeEach(() => {
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("IAP entitlements + Sandbox unlock", () => {
  it("starts unowned, and grant/clear flip the entitlement", () => {
    expect(hasSandboxEntitlement()).toBe(false);
    grantSandboxEntitlement();
    expect(hasSandboxEntitlement()).toBe(true);
    clearSandboxEntitlement();
    expect(hasSandboxEntitlement()).toBe(false);
  });

  it("exposes product metadata with the right id and a display price", async () => {
    const p = await getSandboxProduct();
    expect(p.id).toBe(SANDBOX_PRODUCT_ID);
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.price).toMatch(/\d/); // a localized price string with a number
  });

  it("a web purchase grants the entitlement and is idempotent", async () => {
    expect(hasSandboxEntitlement()).toBe(false);
    const r1 = await purchaseSandbox();
    expect(r1.status).toBe("purchased");
    expect(hasSandboxEntitlement()).toBe(true);
    // buying again when already owned is a no-op "purchased" (never double-charges)
    const r2 = await purchaseSandbox();
    expect(r2.status).toBe("purchased");
  });

  it("restore reports true only once the entitlement is held", async () => {
    expect((await restoreSandbox()).restored).toBe(false);
    grantSandboxEntitlement();
    expect((await restoreSandbox()).restored).toBe(true);
  });
});

// Revenue-critical regression guard: on NATIVE, the unwired stub must never simulate a
// purchase (that would give Creative Mode away for free on iOS — or worse, look like a
// charge without StoreKit), and the purchase UI must be hidden (iapAvailable false).
describe("IAP native gate (StoreKit unwired)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("web reports IAP available (simulated test channel)", () => {
    expect(iapAvailable()).toBe(true);
  });

  it("native purchase is unavailable and grants nothing until StoreKit is wired", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(iapAvailable()).toBe(false); // Settings hides the buy/restore UI on this
    const res = await purchaseSandbox();
    expect(res.status).toBe("unavailable");
    expect(hasSandboxEntitlement()).toBe(false);
    expect((await restoreSandbox()).restored).toBe(false);
  });
});
