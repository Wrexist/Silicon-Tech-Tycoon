import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import {
  hasSandboxEntitlement,
  grantSandboxEntitlement,
  clearSandboxEntitlement,
  withValidatedSandbox,
} from "./entitlements.ts";
import {
  applyTransactionUpdate,
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

  it("withValidatedSandbox honors sandboxUnlocked only when the entitlement is owned", () => {
    // Not owned (e.g. an imported save on a device that never bought it): the flag is forced off.
    expect(withValidatedSandbox({ sandboxUnlocked: true }).sandboxUnlocked).toBe(false);
    expect(withValidatedSandbox({ sandboxUnlocked: false }).sandboxUnlocked).toBe(false);
    // Owned: the flag passes through unchanged, and other fields are preserved.
    grantSandboxEntitlement();
    expect(withValidatedSandbox({ sandboxUnlocked: true }).sandboxUnlocked).toBe(true);
    expect(withValidatedSandbox({ sandboxUnlocked: true, cash: 42 }).cash).toBe(42);
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

// Revenue-critical regression guard. StoreKit is now WIRED (NATIVE_IAP_WIRED = true), so the
// purchase UI is shown on native. The invariant that must never regress: the entitlement is
// granted ONLY when the store confirms a purchase. If the native bridge can't complete a sale
// (as in this test env, where no StoreKit runtime exists), nothing may be unlocked — a broken
// or absent store must never give Creative Mode away for free, nor report a phantom "purchased".
describe("IAP native gate (StoreKit wired)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("web reports IAP available (simulated test channel)", () => {
    expect(iapAvailable()).toBe(true);
  });

  it("native exposes the purchase UI now that StoreKit is wired", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(iapAvailable()).toBe(true);
  });

  it("native purchase never unlocks unless StoreKit confirms it", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    // No real StoreKit bridge in the test env → the purchase cannot complete.
    const res = await purchaseSandbox();
    expect(res.status).not.toBe("purchased");
    expect(hasSandboxEntitlement()).toBe(false);
    // Restore likewise grants nothing without a confirmed entitlement.
    expect((await restoreSandbox()).restored).toBe(false);
    expect(hasSandboxEntitlement()).toBe(false);
  });

  it("an out-of-band transaction update grants the entitlement (only for our product)", () => {
    expect(hasSandboxEntitlement()).toBe(false);
    applyTransactionUpdate("com.wrexist.silicon.somethingelse");
    expect(hasSandboxEntitlement()).toBe(false); // unrelated product → no grant
    // An Ask-to-Buy / Family-Sharing approval delivered via the native listener must unlock.
    applyTransactionUpdate(SANDBOX_PRODUCT_ID);
    expect(hasSandboxEntitlement()).toBe(true);
  });
});
