// The Silicon Pro purchase flow — the seam between the paywall and StoreKit 2.
//
// Native (iOS): routes through `ios/App/App/SiliconStoreKit.swift`. Web / dev preview: NOT a sales
// channel, so purchases are simulated and `syncPro` is inert — that keeps the paywall, the gates and
// every unlock testable in a browser without a device.
//
// ── THE TWO RULES THAT COST REAL MONEY IF BROKEN ────────────────────────────────────────────────
// 1. NEVER grant on anything but a confirmed store success. Cancel, pending, error and "bridge
//    missing" all leave the entitlement untouched.
// 2. NEVER revoke on anything but a confirmed store "you have nothing". A network blip, a StoreKit
//    hiccup or a plugin-less build must leave an existing record alone — `syncPro` only calls
//    `clearProRecord()` when the device positively reported no subscription AND no lifetime
//    purchase. Failing that check open would log paying customers out of what they bought.
import { storeKit, isNative, type NativeProduct } from "./storeKitBridge.ts";
import {
  PRO_PRODUCT_IDS,
  PRO_SUBSCRIPTION_GROUP,
  clearProRecord,
  getProRecord,
  grantFounding,
  isFoundingBuild,
  isPro,
  proProduct,
  proRecordFrom,
  setProRecord,
  type ProTier,
} from "./pro.ts";
import { grantSandboxEntitlement } from "./entitlements.ts";

/** Flip to false to ship a build with the Pro purchase path dark (e.g. while App Store Connect
 *  products are still propagating). ON DEVICE this must never fall back to the web mock — that
 *  would hand out free entitlements — so every native path returns "unavailable" instead. */
const NATIVE_PRO_WIRED = true;

/** True when a purchase flow can complete at all on this platform. Web is simulated (for testing);
 *  native depends on the kill-switch above. */
export function proPurchasesAvailable(): boolean {
  return !isNative() || NATIVE_PRO_WIRED;
}

/* ─────────────────────────────  CATALOG  ───────────────────────────── */

/** One purchasable row, resolved against what the store will ACTUALLY sell right now. */
export interface ProOffer {
  id: string;
  /** Localized store price ("kr 39,00", "€3,99"). Falls back to the USD config string off-device.
   *  This is the ONLY price string that may ever be shown — see `amount`. */
  price: string;
  /** The numeric price behind `price`, for plan-vs-plan value math only. Never rendered: formatting
   *  money in JS is how a paywall ends up claiming a price the store won't charge. */
  amount?: number;
  /** ISO-4217 code for `amount`. Guards the comparison, never formats. */
  currency?: string;
  /** True when this Apple ID can still claim the introductory free trial on this SKU. */
  trialEligible: boolean;
  /** Localized trial length from the store when available ("7 days"), else our copy fills in. */
  trialPeriod?: string;
  /** True for the lifetime SKU once the device already owns it. */
  owned: boolean;
}

export type CatalogState = "ready" | "unavailable";

export interface ProCatalog {
  state: CatalogState;
  offers: ProOffer[];
  /** False on web/dev, where everything is simulated — callers must NOT render a store-error state. */
  fromStore: boolean;
}

/** USD-fallback catalog used on web/dev and as the shape for a store that answered with nothing. */
function fallbackCatalog(): ProCatalog {
  return {
    state: "ready",
    fromStore: false,
    offers: PRO_PRODUCTS_FALLBACK(),
  };
}

function PRO_PRODUCTS_FALLBACK(): ProOffer[] {
  return PRO_PRODUCT_IDS.map((id) => {
    const p = proProduct(id)!;
    return {
      id,
      price: p.fallbackPrice,
      amount: p.fallbackAmount,
      currency: "USD", // the fallback table is USD by definition; on device the store's own wins
      trialEligible: p.hasTrial,
      owned: false,
    };
  });
}

/**
 * Ask the store what it can actually sell, with localized prices and real trial eligibility.
 *
 * This exists to avoid the App Review 2.1.0 failure mode that rejects builds: a paywall that
 * presents a buy button which can only ever error. If a real device comes back with nothing, the
 * paywall shows an honest retry state instead of a CTA.
 */
export async function getProCatalog(): Promise<ProCatalog> {
  // Kill-switch flipped ON DEVICE: purchasePro() answers "unavailable", so the catalog must say so
  // too. Returning the fallback plans here would render live-looking CTAs that can only ever fail —
  // precisely the App Review 2.1.0 failure this probe exists to prevent.
  if (isNative() && !NATIVE_PRO_WIRED) return { state: "unavailable", offers: [], fromStore: true };
  // Off-device (web/dev preview) purchases are simulated, so every plan stays live and testable.
  if (!isNative()) return fallbackCatalog();

  try {
    const res = await storeKit().getProducts({ productIds: PRO_PRODUCT_IDS });
    const products: NativeProduct[] = res?.products ?? [];
    const offers: ProOffer[] = [];
    for (const id of PRO_PRODUCT_IDS) {
      const hit = products.find((p) => p.id === id);
      if (!hit) continue; // the store didn't offer it — don't render a row that can only fail
      const cfg = proProduct(id)!;
      offers.push({
        id,
        price: hit.price?.trim() || cfg.fallbackPrice,
        // Numeric amount for value math. Only taken when the store actually gave us one — never
        // paired with the USD fallback string, which would compare a real price against a
        // config constant and could invent a saving that isn't real in this storefront.
        amount: typeof hit.priceAmount === "number" && Number.isFinite(hit.priceAmount) ? hit.priceAmount : undefined,
        currency: hit.currencyCode,
        // Only a SKU that carries a trial AND an Apple ID that hasn't used it shows trial framing.
        // Showing "7 days free" to an ineligible user is a false claim (Apple 3.1.2 exposure).
        trialEligible: cfg.hasTrial && hit.introEligible === true,
        trialPeriod: hit.introPeriod,
        owned: hit.owned === true,
      });
    }
    return { state: offers.length > 0 ? "ready" : "unavailable", offers, fromStore: true };
  } catch {
    return { state: "unavailable", offers: [], fromStore: true };
  }
}

/* ─────────────────────────────  PURCHASE  ───────────────────────────── */

export type ProPurchaseStatus = "purchased" | "cancelled" | "pending" | "unavailable" | "error";
export interface ProPurchaseResult {
  status: ProPurchaseStatus;
  message?: string;
}

/**
 * Buy a Pro SKU. Grants the entitlement ONLY on a confirmed store success. A user dismissing the
 * StoreKit sheet is `cancelled` — not an error, no charge, and nothing to apologise for; treating
 * that as a failure (with a red banner) is a documented App Review 2.1.0 rejection.
 */
export async function purchasePro(productId: string): Promise<ProPurchaseResult> {
  const cfg = proProduct(productId);
  if (!cfg) return { status: "unavailable", message: "That plan isn't available." };

  if (!isNative()) {
    // WEB / dev preview — not a sales channel. Simulate success so the whole funnel (paywall →
    // unlock → gates falling away) is exercisable in a browser. The native build is the real one.
    setProRecord(proRecordFrom({
      tier: cfg.tier,
      productId,
      expiresAt: cfg.recurring ? new Date(Date.now() + mockPeriodMs(cfg.tier)).toISOString() : null,
      isTrial: cfg.hasTrial,
    }));
    return { status: "purchased" };
  }

  if (!NATIVE_PRO_WIRED) {
    // Kill-switch flipped ON DEVICE. Never fall through to the mock — that would grant Pro free.
    return { status: "unavailable", message: "Purchases are temporarily unavailable." };
  }

  try {
    const res = await storeKit().purchase({ productId });
    switch (res.status) {
      case "purchased": {
        // Re-read the truth from StoreKit rather than trusting the local guess: the store knows the
        // real expiry, whether an intro offer applied, and the renewal flag.
        const synced = await syncPro();
        if (!synced) {
          // Purchase confirmed but the status read failed (rare, transient). Write a conservative
          // record so the player gets what they paid for immediately; the next sync corrects it.
          setProRecord(proRecordFrom({
            tier: cfg.tier,
            productId,
            expiresAt: null, // no date → bounded trust window, never permanent (see pro.ts)
            isTrial: cfg.hasTrial,
          }));
        }
        return { status: "purchased" };
      }
      case "cancelled":
        return { status: "cancelled" };
      case "pending":
        // Ask-to-Buy / SCA. It'll unlock on its own via the transaction listener once approved.
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

/** Mock subscription length for the web preview only. */
function mockPeriodMs(tier: ProTier): number {
  return tier === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
}

/* ─────────────────────────────  RESTORE  ───────────────────────────── */

/** App Store "Restore Purchases". Required on every paywall by Apple's own checklist — a user who
 *  reinstalls or switches devices must have a way back to what they already own. */
export async function restorePro(): Promise<{ restored: boolean }> {
  if (!isNative()) return { restored: isPro() };
  if (!NATIVE_PRO_WIRED) return { restored: isPro() };

  try {
    await storeKit().restore({});
  } catch {
    /* the sync below is still worth attempting — restore() mainly forces an App Store refresh */
  }
  await syncPro();
  return { restored: isPro() };
}

/* ─────────────────────────────  SYNC  ───────────────────────────── */

/**
 * Reconcile the local record with the store's truth. Returns true when the device gave a confident
 * answer (either way), false when it couldn't be reached — callers use that to decide whether a
 * fallback write is needed.
 *
 * Order matters: permanent grants are checked FIRST, so a Founding Owner or a Lifetime buyer is
 * never downgraded by a subscription read that legitimately says "no active subscription".
 */
export async function syncPro(): Promise<boolean> {
  if (!isNative() || !NATIVE_PRO_WIRED) return false;

  // Revoking requires a definitive NO from BOTH sources that can entitle a user. One of them
  // throwing while the other says "no" is not evidence of a lapse — it's a partial read, and acting
  // on it would log a paying subscriber out. Tracked separately for exactly that reason.
  let lifetimeAnswered = false;
  let subscriptionAnswered = false;

  // 1. Founding Owners — anyone whose ORIGINAL download was a paid build. They bought this game
  //    outright before it went free; taking it away would be theft, and they are also the most
  //    valuable word-of-mouth cohort the app has. A failure here is never revoking evidence: the
  //    API needs iOS 16, so on older systems it simply can't answer.
  try {
    const { originalBuild } = await storeKit().originalPurchase();
    if (isFoundingBuild(originalBuild)) {
      grantFounding();
      // Creative Mode was the paid era's only IAP; a Founding Owner keeps it too.
      grantSandboxEntitlement();
      return true;
    }
  } catch {
    /* iOS < 16 or a transient failure — fall through */
  }

  // 2. Lifetime (a non-consumable, so ownership is permanent and restorable).
  const lifetime = proProduct("com.wrexist.silicon.pro.lifetime");
  if (lifetime) {
    try {
      const { owned } = await storeKit().isOwned({ productId: lifetime.id });
      lifetimeAnswered = true;
      if (owned) {
        const rec = getProRecord();
        if (!rec || rec.tier !== "lifetime") {
          setProRecord(proRecordFrom({ tier: "lifetime", productId: lifetime.id, expiresAt: null }));
        }
        grantSandboxEntitlement(); // Creative Mode is included with Pro
        return true;
      }
    } catch {
      /* unreadable — do not revoke */
    }
  }

  // 3. The recurring subscription group.
  try {
    const status = await storeKit().subscriptionStatus({ groupId: PRO_SUBSCRIPTION_GROUP });
    subscriptionAnswered = true;
    if (status?.active) {
      const cfg = status.productId ? proProduct(status.productId) : undefined;
      setProRecord(proRecordFrom({
        tier: cfg?.tier ?? "monthly",
        productId: status.productId ?? "",
        expiresAt: status.expiresAt ?? null,
        isTrial: status.isTrial === true,
        willRenew: status.willRenew !== false,
        inGracePeriod: status.inGracePeriod === true,
      }));
      grantSandboxEntitlement(); // Creative Mode is included with Pro
      return true;
    }
  } catch {
    /* unreadable — do not revoke */
  }

  // 4. Both sources answered, and both said no. Only now is a lapse real.
  if (lifetimeAnswered && subscriptionAnswered) {
    const rec = getProRecord();
    // A Founding record is permanent AND is not re-derivable on iOS < 16, so "no purchases found"
    // must never clear it — that would strip a paid-era owner on the first sync after an OS
    // downgrade or an AppTransaction hiccup.
    if (rec?.tier === "founding") return true;
    clearProRecord();
    return true;
  }
  return false;
}

/* ─────────────────────────────  BOOT  ───────────────────────────── */

let listenerBound = false;

/**
 * Called once at native boot (see `native.ts`). Reconciles entitlements with the store and starts
 * listening for transactions that clear OUTSIDE an active purchase call — Ask-to-Buy approvals,
 * Family Sharing, a renewal landing while the app is open, or a purchase made on another device.
 * Idempotent and never throws.
 */
export async function initPro(): Promise<void> {
  if (!isNative() || !NATIVE_PRO_WIRED) return;

  if (!listenerBound) {
    listenerBound = true;
    try {
      await storeKit().addListener("transactionUpdated", (data) => {
        // A Pro SKU, the legacy Creative Mode unlock, or a renewal — any of them changes standing,
        // so re-read the store rather than guessing from the product id alone.
        if (data?.productId === "com.wrexist.silicon.sandbox") grantSandboxEntitlement();
        void syncPro();
      });
    } catch {
      listenerBound = false; // an older native build without the listener — buy/restore still work
    }
  }

  // Note on the legacy Creative Mode unlock: `syncPro` never touches it except to GRANT it (to Pro
  // subscribers and Founding Owners). Someone who bought that standalone IAP during the paid era
  // and isn't a Founding Owner keeps it forever through `entitlements.ts` — it is a separate,
  // permanent purchase and is deliberately not folded into, or revoked by, subscription status.
  await syncPro();
}

/** Open Apple's native subscription-management sheet (falls back to the account URL). Never throws. */
export async function manageProSubscription(): Promise<boolean> {
  if (!isNative()) {
    try {
      window.open("https://apps.apple.com/account/subscriptions", "_blank", "noopener");
    } catch {
      /* ignore */
    }
    return true;
  }
  try {
    const res = await storeKit().manageSubscriptions();
    return res?.shown === true;
  } catch {
    return false;
  }
}
