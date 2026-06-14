// In-app purchases — the single v1 IAP: the Sandbox / Creative-mode unlock. The base game is a
// paid premium download (App Store handles that), so the only purchase code is this one unlock.
//
// This module is the seam between the UI and the platform store. The WEB build (PWA / dev preview)
// is not a sales channel, so it simulates a successful purchase for testing. The iOS build routes
// to StoreKit 2 through a small custom Capacitor plugin (no third-party purchase SDK).
//
// ── NATIVE WIRING ───────────────────────────────────────────────────────────────────────────────
// StoreKit IS wired (NATIVE_IAP_WIRED = true). The native side is `ios/App/App/SiliconStoreKit.swift`
// — a minimal StoreKit 2 plugin (Product.products / purchase / Transaction.currentEntitlements /
// AppStore.sync). We use StoreKit 2 directly rather than a third-party purchase SDK so the App
// Privacy "no third-party SDKs / data not collected" declaration stays literally true, and so the
// SPM-only iOS target needs no CocoaPods. Remaining one-time Xcode setup is in appstore/IAP_GUIDE.md
// (add the In-App Purchase capability + a .storekit config for the simulator). Nothing here ever
// throws: the same bundle runs in the browser and inside the native shell.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { grantSandboxEntitlement, hasSandboxEntitlement } from "./entitlements.ts";

/** App Store product identifier for the non-consumable Sandbox / Creative-mode unlock. */
export const SANDBOX_PRODUCT_ID = "com.wrexist.silicon.sandbox";

/** True now that the native StoreKit 2 plugin (SiliconStoreKit.swift) backs the three points below. */
const NATIVE_IAP_WIRED = true;

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

export type PurchaseStatus = "purchased" | "cancelled" | "pending" | "unavailable" | "error";
export interface PurchaseResult {
  status: PurchaseStatus;
  message?: string;
}

// ── Native bridge (implemented in ios/App/App/SiliconStoreKit.swift) ─────────────────────────────
interface NativeProduct {
  available: boolean;
  id?: string;
  displayName?: string;
  description?: string;
  price?: string;
  owned?: boolean;
}
interface SiliconStoreKitPlugin {
  getProduct(options: { productId: string }): Promise<NativeProduct>;
  purchase(options: { productId: string }): Promise<{ status: string; message?: string }>;
  restore(options: { productId: string }): Promise<{ restored: boolean }>;
  isOwned(options: { productId: string }): Promise<{ owned: boolean }>;
  addListener(
    eventName: "transactionUpdated",
    listenerFunc: (data: { productId: string }) => void,
  ): Promise<PluginListenerHandle>;
}

// Registered lazily (inside try/catch at each call site) so a missing bridge — web, tests, an old
// build — can never throw at import time; it just falls back to the safe path.
let pluginRef: SiliconStoreKitPlugin | null = null;
function storeKit(): SiliconStoreKitPlugin {
  if (!pluginRef) pluginRef = registerPlugin<SiliconStoreKitPlugin>("SiliconStoreKit");
  return pluginRef;
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
 * Native: yes, now that StoreKit is wired. (Before wiring this returned false so the Settings
 * screen hid the buy/restore UI and the app could ship without the IAP attached.)
 */
export function iapAvailable(): boolean {
  return !isNative() || NATIVE_IAP_WIRED;
}

/** Product info for the Sandbox unlock (localized price on native via StoreKit). Never throws. */
export async function getSandboxProduct(): Promise<ProductInfo> {
  if (isNative()) {
    // ── NATIVE INTEGRATION POINT 1/3 (StoreKit: product metadata) ────────────────────────────
    try {
      const p = await storeKit().getProduct({ productId: SANDBOX_PRODUCT_ID });
      if (p?.available) {
        return {
          id: p.id || SANDBOX_PRODUCT_ID,
          title: p.displayName?.trim() || SANDBOX_FALLBACK.title,
          description: p.description?.trim() || SANDBOX_FALLBACK.description,
          price: p.price?.trim() || SANDBOX_FALLBACK.price,
        };
      }
    } catch {
      /* store slow/unreachable — fall through to fallback so the UI still renders a price */
    }
  }
  return SANDBOX_FALLBACK;
}

/** Begin a purchase of the Sandbox unlock. Grants the entitlement on success. Never throws. */
export async function purchaseSandbox(): Promise<PurchaseResult> {
  if (hasSandboxEntitlement()) return { status: "purchased" };

  if (isNative()) {
    // ── NATIVE INTEGRATION POINT 2/3 (StoreKit: purchase) ────────────────────────────────────
    // Grant ONLY when StoreKit confirms "purchased". Any other outcome (cancel, pending, error,
    // or an absent bridge) must leave the entitlement untouched — the revenue guard.
    try {
      const res = await storeKit().purchase({ productId: SANDBOX_PRODUCT_ID });
      switch (res.status) {
        case "purchased":
          grantSandboxEntitlement();
          return { status: "purchased" };
        case "cancelled":
          return { status: "cancelled" };
        case "pending":
          return { status: "pending", message: res.message ?? "Your purchase is pending approval." };
        case "unavailable":
          return { status: "unavailable", message: res.message };
        default:
          return { status: "error", message: res.message ?? "The purchase didn't complete." };
      }
    } catch {
      return { status: "error", message: "The purchase couldn't be started. Please try again." };
    }
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
    try {
      const res = await storeKit().restore({ productId: SANDBOX_PRODUCT_ID });
      if (res.restored) grantSandboxEntitlement();
      return { restored: res.restored || hasSandboxEntitlement() };
    } catch {
      return { restored: hasSandboxEntitlement() };
    }
  }
  // Web: the entitlement already lives in localStorage on this device.
  return { restored: hasSandboxEntitlement() };
}

/** Window event fired when the owned entitlement changes out-of-band (an Ask-to-Buy / Family
 *  Sharing approval that lands while the app is open). The Settings UI listens for it so the
 *  "owned" state refreshes live instead of waiting for a remount. */
export const IAP_ENTITLEMENT_EVENT = "silicon:iap-entitlement-updated";

/** Apply a StoreKit transaction that cleared outside an active purchase() call: grant the
 *  entitlement and notify any mounted UI. Exported (and bridge-free) so it's unit-testable. */
export function applyTransactionUpdate(productId: string | undefined): void {
  if (productId !== SANDBOX_PRODUCT_ID) return;
  grantSandboxEntitlement();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(IAP_ENTITLEMENT_EVENT));
}

/** Listen for transactions approved out-of-band (Ask-to-Buy, Family Sharing, another device) and
 *  grant the entitlement live. Idempotent and safe to call once at native boot (see native.ts). */
let listenerHandle: PluginListenerHandle | null = null;
export async function initIapListeners(): Promise<void> {
  if (!isNative() || listenerHandle) return;
  try {
    listenerHandle = await storeKit().addListener("transactionUpdated", (data) => {
      applyTransactionUpdate(data?.productId);
    });
  } catch {
    /* listener unsupported on this build — buy/restore still work without it */
  }
}
