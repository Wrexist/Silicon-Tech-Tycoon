// In-app purchases — the single v1 IAP: the Sandbox / Creative-mode unlock. The base game is a
// paid premium download (App Store handles that), so the only purchase code is this one unlock.
//
// This module is the seam between the UI and the platform store. The WEB build (PWA / dev preview)
// is not a sales channel, so it simulates a successful purchase for testing. The iOS build routes
// to StoreKit through a Capacitor purchases plugin — that single integration point is marked below
// and is the only thing to complete on the Mac (see BUILD_IOS.md). Nothing here ever throws: the
// same bundle runs in the browser and inside the native shell.
import { Capacitor } from "@capacitor/core";
import { grantSandboxEntitlement, hasSandboxEntitlement } from "./entitlements.ts";

/** App Store product identifier for the non-consumable Sandbox / Creative-mode unlock. */
export const SANDBOX_PRODUCT_ID = "com.wrexist.silicon.sandbox";

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

/** Product info for the Sandbox unlock (localized price on native once StoreKit is wired). */
export async function getSandboxProduct(): Promise<ProductInfo> {
  if (isNative()) {
    // ── NATIVE INTEGRATION POINT (StoreKit) ──────────────────────────────────────────────
    // With a purchases plugin installed (e.g. @capacitor-community/in-app-purchases or RevenueCat),
    // query the live product and return its localized price string:
    //   const { products } = await InAppPurchases.getProducts({ productIds: [SANDBOX_PRODUCT_ID] });
    //   const p = products[0];
    //   if (p) return { id: p.id, title: p.title, description: p.description, price: p.price };
    // Until that's wired, fall through to the fallback metadata (the UI still renders correctly).
  }
  return SANDBOX_FALLBACK;
}

/** Begin a purchase of the Sandbox unlock. Grants the entitlement on success. Never throws. */
export async function purchaseSandbox(): Promise<PurchaseResult> {
  if (hasSandboxEntitlement()) return { status: "purchased" };

  if (isNative()) {
    // ── NATIVE INTEGRATION POINT (StoreKit) ──────────────────────────────────────────────
    // Replace this stub with the plugin's purchase call, then grant on a verified transaction:
    //   try {
    //     const res = await InAppPurchases.purchase({ productId: SANDBOX_PRODUCT_ID });
    //     if (res.transaction?.state === "purchased") { grantSandboxEntitlement(); return { status: "purchased" }; }
    //     if (res.transaction?.state === "cancelled") return { status: "cancelled" };
    //     return { status: "error", message: "Purchase did not complete." };
    //   } catch (e) { return { status: "error", message: String(e) }; }
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
    // ── NATIVE INTEGRATION POINT (StoreKit) ──────────────────────────────────────────────
    //   const { purchases } = await InAppPurchases.restorePurchases();
    //   if (purchases.some((p) => p.productId === SANDBOX_PRODUCT_ID)) { grantSandboxEntitlement(); return { restored: true }; }
    //   return { restored: false };
    return { restored: hasSandboxEntitlement() };
  }
  // Web: the entitlement already lives in localStorage on this device.
  return { restored: hasSandboxEntitlement() };
}
