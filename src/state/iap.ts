// In-app purchases — the single v1 IAP: the Sandbox / Creative-mode unlock. The base game is a
// paid premium download (App Store handles that), so the only purchase code is this one unlock.
//
// This module is the seam between the UI and the platform store. The WEB build (PWA / dev preview)
// is not a sales channel, so it simulates a successful purchase for testing. The iOS build routes
// to StoreKit through a purchases plugin — the integration points are marked below.
//
// ── NATIVE WIRING STATUS ──────────────────────────────────────────────────────────────────────
// StoreKit is NOT wired yet. Until it is, `iapAvailable()` returns false on native and the
// Settings screen hides the purchase UI entirely, so the app can be submitted WITHOUT the IAP
// attached (no dead buy button = no Guideline 2.1 rejection). To wire it:
//   1. `npm i cordova-plugin-purchase` (v13+ — works with Capacitor; the package previously
//      referenced in older docs, @capacitor-community/in-app-purchases, does not exist on npm).
//      Alternative: @revenuecat/purchases-capacitor — check its compatibility table for the
//      major that supports this project's Capacitor version before installing.
//   2. Implement the three NATIVE INTEGRATION POINTs below against the installed plugin's real
//      API (verify against its docs — the sketches here follow cordova-plugin-purchase v13).
//   3. Flip NATIVE_IAP_WIRED to true, `npm run build && npx cap sync ios`, and test with a
//      StoreKit Configuration file in Xcode (see BUILD_IOS.md §4).
// Nothing here ever throws: the same bundle runs in the browser and inside the native shell.
import { Capacitor } from "@capacitor/core";
import { grantSandboxEntitlement, hasSandboxEntitlement } from "./entitlements.ts";

/** App Store product identifier for the non-consumable Sandbox / Creative-mode unlock. */
export const SANDBOX_PRODUCT_ID = "com.wrexist.silicon.sandbox";

/** Flip to true once the three NATIVE INTEGRATION POINTs below call a real purchases plugin. */
const NATIVE_IAP_WIRED = false;

/** Fallback product metadata used on web and before StoreKit returns the localized price. */
const SANDBOX_FALLBACK: ProductInfo = {
  id: SANDBOX_PRODUCT_ID,
  title: "Creative Mode",
  description: "Design freely with no financial limits — an unlimited cash floor so you can never go bankrupt.",
  price: "$2.99",
};

export interface ProductInfo {
  id: string;
  title: string;
  description: string;
  price: string; // localized display string, e.g. "$2.99"
}

export type PurchaseStatus = "purchased" | "cancelled" | "unavailable" | "error";
export interface PurchaseResult {
  status: PurchaseStatus;
  message?: string;
}

/** True when running inside the native iOS shell (vs. the browser/PWA). */
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Can a purchase flow actually complete on this platform?
 * Web: yes (simulated — not a sales channel, used for testing Creative Mode in the browser).
 * Native: only once StoreKit is wired. The Settings screen hides the buy/restore UI when this
 * is false, so an unwired build never shows a purchase button that dead-ends.
 */
export function iapAvailable(): boolean {
  return !isNative() || NATIVE_IAP_WIRED;
}

/** Product info for the Sandbox unlock (localized price on native once StoreKit is wired). */
export async function getSandboxProduct(): Promise<ProductInfo> {
  if (isNative()) {
    // ── NATIVE INTEGRATION POINT 1/3 (StoreKit: product metadata) ────────────────────────────
    // cordova-plugin-purchase v13 sketch (verify against the installed plugin's docs):
    //   const { store, Platform } = CdvPurchase;
    //   const p = store.get(SANDBOX_PRODUCT_ID, Platform.APPLE_APPSTORE);
    //   const offer = p?.getOffer();
    //   if (p && offer) return { id: p.id, title: p.title, description: p.description,
    //                            price: offer.pricingPhases[0]?.price ?? SANDBOX_FALLBACK.price };
    // Until wired, fall through to the fallback metadata (the UI still renders correctly).
  }
  return SANDBOX_FALLBACK;
}

/** Begin a purchase of the Sandbox unlock. Grants the entitlement on success. Never throws. */
export async function purchaseSandbox(): Promise<PurchaseResult> {
  if (hasSandboxEntitlement()) return { status: "purchased" };

  if (isNative()) {
    // ── NATIVE INTEGRATION POINT 2/3 (StoreKit: purchase) ────────────────────────────────────
    // cordova-plugin-purchase v13 sketch — register + initialize once at app start, then:
    //   store.register([{ id: SANDBOX_PRODUCT_ID, type: ProductType.NON_CONSUMABLE,
    //                     platform: Platform.APPLE_APPSTORE }]);
    //   store.when().approved((tx) => tx.verify());
    //   store.when().verified((receipt) => { receipt.finish(); grantSandboxEntitlement(); });
    //   await store.initialize([Platform.APPLE_APPSTORE]);
    //   const offer = store.get(SANDBOX_PRODUCT_ID, Platform.APPLE_APPSTORE)?.getOffer();
    //   if (!offer) return { status: "unavailable" };
    //   const err = await offer.order();
    //   if (err?.isError && err.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED)
    //     return { status: "cancelled" };
    //   return hasSandboxEntitlement() ? { status: "purchased" }
    //                                  : { status: "error", message: "Purchase did not complete." };
    return { status: "unavailable", message: "In-app purchases aren't available in this build yet." };
  }

  // WEB / dev preview: not a sales channel — simulate a successful purchase so Creative Mode is
  // testable in the browser. The native build is the real, paid channel.
  grantSandboxEntitlement();
  return { status: "purchased" };
}

/** Restore a previously-purchased Sandbox unlock (App Store "Restore Purchases"). Never throws. */
export async function restoreSandbox(): Promise<{ restored: boolean }> {
  if (isNative()) {
    // ── NATIVE INTEGRATION POINT 3/3 (StoreKit: restore) ─────────────────────────────────────
    // cordova-plugin-purchase v13 sketch — the verified handler above grants the entitlement:
    //   await store.restorePurchases();
    //   return { restored: hasSandboxEntitlement() };
    // NOTE: until wired this only re-reads the local flag — it cannot recover a purchase after
    // reinstall, which is why the restore button is hidden while iapAvailable() is false.
    return { restored: hasSandboxEntitlement() };
  }
  // Web: the entitlement already lives in localStorage on this device.
  return { restored: hasSandboxEntitlement() };
}
