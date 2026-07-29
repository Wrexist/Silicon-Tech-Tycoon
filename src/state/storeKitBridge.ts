// The single seam to the native store. ONE Capacitor plugin proxy, shared by both purchase modules
// (`iap.ts` — the legacy Creative Mode non-consumable — and `proStore.ts` — the Silicon Pro
// subscription group), so `registerPlugin` runs once and the `transactionUpdated` listener is
// registered once. Two proxies would double-deliver every out-of-band transaction.
//
// Native side: `ios/App/App/SiliconStoreKit.swift`, which serves this interface from ONE of two
// backends behind a single switch (`ios/App/App/RevenueCatConfig.swift`):
//   • StoreKit 2 direct — Apple only, on-device, no third party, and
//   • RevenueCat's native iOS SDK (`SiliconStoreKit+RevenueCat.swift`), for cross-platform
//     entitlements, server-side receipt validation and subscription analytics.
// Both satisfy the contracts below identically, so nothing in this file — or in any caller —
// changes when the backend does.
//
// ⚠️ PRIVACY: with the RevenueCat backend live the app is NO LONGER "Data Not Collected". RevenueCat
// processes purchase history and a device identifier on our behalf. `PrivacyInfo.xcprivacy`, the App
// Store Connect App Privacy answers and `docs/privacy/` all reflect that; see `MONETIZATION.md`
// §"Privacy" before writing any copy that claims otherwise.
//
// Nothing here throws: the same bundle runs in the browser, in Vitest, and inside the native shell.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/** One product as StoreKit describes it. Subscription fields are absent for non-consumables. */
export interface NativeProduct {
  id: string;
  displayName?: string;
  description?: string;
  /** Localized display price, e.g. "$3.99", "kr 39,00", "€3,99". NEVER format this yourself. */
  price?: string;
  /** True for a non-consumable the device already owns (Creative Mode, Pro Lifetime). */
  owned?: boolean;
  /** "auto-renewable" | "non-consumable" | "consumable" | "non-renewable". */
  kind?: string;
  /** Subscription period, e.g. { unit: "month", count: 1 }. Absent for one-time products. */
  periodUnit?: string;
  periodCount?: number;
  /** True when this Apple ID may still claim the product's introductory (free-trial) offer. */
  introEligible?: boolean;
  /** Localized intro-offer period, e.g. "7 days". Only meaningful when `introEligible`. */
  introPeriod?: string;
  /** Subscription group id — used to read group-wide status. */
  groupId?: string;
}

/** The device's live subscription standing for the Pro group, straight from StoreKit. */
export interface NativeSubscriptionStatus {
  /** True when StoreKit reports an entitling state (subscribed, trial, grace period). */
  active: boolean;
  /** The product currently entitling the user, when active. */
  productId?: string;
  /** ISO-8601 expiry. May be absent even while active (sandbox, promotional entitlements). */
  expiresAt?: string;
  /** True during an introductory/free-trial period. */
  isTrial?: boolean;
  /** False once the user has cancelled but the paid period hasn't ended. */
  willRenew?: boolean;
  /** True during a billing-retry grace period — still entitled, but payment is failing. */
  inGracePeriod?: boolean;
}

export interface SiliconStoreKitPlugin {
  getProduct(options: { productId: string }): Promise<NativeProduct & { available: boolean }>;
  /** Batch metadata fetch. Unknown/unconfigured ids are simply omitted from `products`. */
  getProducts(options: { productIds: string[] }): Promise<{ products: NativeProduct[] }>;
  purchase(options: { productId: string }): Promise<{ status: string; message?: string }>;
  restore(options: { productId?: string }): Promise<{ restored: boolean; owned?: string[] }>;
  isOwned(options: { productId: string }): Promise<{ owned: boolean }>;
  /** Live status for a subscription group (all Pro SKUs share one group). */
  subscriptionStatus(options: { groupId: string }): Promise<NativeSubscriptionStatus>;
  /** Apple's native "Manage Subscriptions" sheet. Falls back to the account URL. */
  manageSubscriptions(): Promise<{ shown: boolean }>;
  /** The build number (CFBundleVersion) of the user's ORIGINAL download — the paid-era check. */
  originalPurchase(): Promise<{ originalBuild?: number; originalVersion?: string }>;
  requestReview(): Promise<{ requested: boolean }>;
  addListener(
    eventName: "transactionUpdated",
    listenerFunc: (data: { productId: string }) => void,
  ): Promise<PluginListenerHandle>;
}

let pluginRef: SiliconStoreKitPlugin | null = null;

/** The shared plugin proxy. Registered lazily so a missing bridge (web, tests, an older native
 *  build) can never throw at import time — every call site wraps its use in try/catch anyway. */
export function storeKit(): SiliconStoreKitPlugin {
  if (!pluginRef) pluginRef = registerPlugin<SiliconStoreKitPlugin>("SiliconStoreKit");
  return pluginRef;
}

/** True when running inside the native iOS shell (vs. the browser / PWA / Vitest). */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
