// Silicon Pro — the subscription entitlement. Device-level, persisted OUTSIDE the game save (like
// legacy.ts / entitlements.ts) so it survives new games, restarts, imports, and save resets. PURE-ish
// (localStorage only, injectable clock) so every branch below is unit-testable.
//
// ── WHY THIS FILE IS SHAPED THE WAY IT IS ───────────────────────────────────────────────────────
// Every guard here exists because the same class of bug ships real money losses in both directions:
//
//   • "Has ever purchased" must NEVER grant Pro. Stores keep lapsed subscription SKUs in the
//     purchase history forever, so a single paid month would become Pro for life.
//   • A MISSING expiry date must never read as "lifetime". StoreKit legitimately returns an active
//     entitlement with no expirationDate (sandbox, grace periods, promotional offers). Lifetime is
//     identified by IDENTITY (`tier`), never by the absence of a date.
//   • An UNPARSEABLE expiry must read as expired: `new Date("garbage") < new Date()` is false
//     (NaN comparison), so a malformed record would otherwise grant permanent Pro.
//   • But a real subscriber must not lose Pro just because the app is offline: a recurring record
//     with no expiry is trusted against a BOUNDED window anchored on when we wrote it, long enough
//     to cover a full billing period offline and short enough that it can never become permanent.
//
// The store is always the final judge — `proStore.syncPro()` overwrites this record whenever the
// device can reach StoreKit.
import { mirrorToNative } from "./nativeStore.ts";

/* ─────────────────────────────  PRODUCTS & PRICING  ───────────────────────────── */

/** All Pro SKUs live in ONE App Store Connect subscription group so upgrades/downgrades are a
 *  crossgrade rather than a double charge. Must match the group configured in App Store Connect. */
export const PRO_SUBSCRIPTION_GROUP = "silicon_pro";

export type ProTier = "monthly" | "yearly" | "lifetime" | "founding";

export interface ProProduct {
  id: string;
  tier: ProTier;
  /** Bold row title on the paywall. */
  title: string;
  /** Length of subscription — Apple 3.1.2(c) requires this stated plainly next to the price. */
  lengthLabel: string;
  /** USD fallback shown ONLY on web/dev and before StoreKit returns the localized price. */
  fallbackPrice: string;
  /** Auto-renewing, or a one-time non-consumable. */
  recurring: boolean;
  /** Suffix appended to the billed amount, e.g. "/month". Empty for one-time products. */
  billingSuffix: string;
  /** Whether App Store Connect carries an introductory free-trial offer on this SKU. */
  hasTrial: boolean;
  /** Optional badge, e.g. "BEST VALUE". */
  badge?: string;
  /** Small "why this one" line under the title. Never a countdown, never fake scarcity. */
  note?: string;
}

/** The ladder. Monthly is the low-friction entry, Yearly is the volume seller (and the default
 *  selection), Lifetime captures the premium buyer who refuses subscriptions — historically the
 *  highest-ARPU row for a game that used to be a paid download, and the reason this conversion
 *  keeps the "buy it once and own it" promise the brand was built on.
 *
 *  ⚠ These prices are DISPLAY FALLBACKS for web/dev only. On device the localized StoreKit price
 *  always wins. When you change a price, change it in App Store Connect FIRST — a paywall showing
 *  a price the store won't charge is an Apple 3.1.2 rejection. */
export const PRO_PRODUCTS: ProProduct[] = [
  {
    id: "com.wrexist.silicon.pro.yearly",
    tier: "yearly",
    title: "Pro Yearly",
    lengthLabel: "12 months · auto-renews yearly",
    fallbackPrice: "$19.99",
    recurring: true,
    billingSuffix: "/year",
    hasTrial: true,
    badge: "BEST VALUE",
    note: "Works out to about $1.67 a month.",
  },
  {
    id: "com.wrexist.silicon.pro.lifetime",
    tier: "lifetime",
    title: "Pro Lifetime",
    lengthLabel: "One-time purchase · never renews",
    fallbackPrice: "$29.99",
    recurring: false,
    billingSuffix: "",
    hasTrial: false,
    note: "Buy once, own it forever — including everything added later.",
  },
  {
    id: "com.wrexist.silicon.pro.monthly",
    tier: "monthly",
    title: "Pro Monthly",
    lengthLabel: "1 month · auto-renews monthly",
    fallbackPrice: "$3.99",
    recurring: true,
    billingSuffix: "/month",
    hasTrial: true,
  },
];

export const PRO_PRODUCT_IDS: string[] = PRO_PRODUCTS.map((p) => p.id);

export function proProduct(id: string): ProProduct | undefined {
  return PRO_PRODUCTS.find((p) => p.id === id);
}

/** Free-trial length. ⚠ MUST match the introductory offer configured in App Store Connect for every
 *  SKU with `hasTrial: true`. This constant only drives paywall COPY ("7 days free", "no payment due
 *  now"); the store performs the actual trial. If the two disagree the paywall is making a false
 *  claim — an Apple 3.1.2 rejection. Change both together, store first. */
export const FREE_TRIAL_DAYS = 7;

/** Tiers that never expire, identified by identity — never by a missing expiry date. */
const NON_EXPIRING: ReadonlySet<ProTier> = new Set<ProTier>(["lifetime", "founding"]);

/** How long a recurring record with NO expiry date is trusted, anchored on `grantedAt`. Generous
 *  enough that a paying subscriber keeps Pro through a full billing period offline; bounded so a
 *  dateless record can never become permanent. */
const UNANCHORED_WINDOW_MS: Record<ProTier, number> = {
  monthly: 32 * 24 * 60 * 60 * 1000,
  yearly: 367 * 24 * 60 * 60 * 1000,
  lifetime: Infinity,
  founding: Infinity,
};

/* ─────────────────────────────  THE RECORD  ───────────────────────────── */

export interface ProRecord {
  tier: ProTier;
  /** The SKU that granted this. Empty for `founding` (granted by original-download check). */
  productId: string;
  /** ISO-8601 expiry from the store, or null when the store gave us none. NEVER means "lifetime". */
  expiresAt: string | null;
  /** ISO-8601 stamp of when this record was written — the anchor for the bounded fallback window. */
  grantedAt: string;
  /** True during an introductory free-trial period. */
  isTrial: boolean;
  /** False once the user cancelled but the paid period hasn't ended yet. */
  willRenew: boolean;
  /** True during a billing-retry grace period: still entitled, payment is failing. */
  inGracePeriod: boolean;
}

const PRO_KEY = "silicon.pro.v1";

/** Read the persisted record. Returns null when absent or unreadable — never throws. */
export function getProRecord(): ProRecord | null {
  try {
    const raw = localStorage.getItem(PRO_KEY);
    if (!raw) return null;
    return normalizeRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Coerce a parsed blob into a ProRecord, or null if it isn't one. A hand-edited or corrupted
 *  record must fail CLOSED (no Pro), not open. */
function normalizeRecord(raw: unknown): ProRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ProRecord>;
  if (typeof r.tier !== "string" || !(r.tier in UNANCHORED_WINDOW_MS)) return null;
  return {
    tier: r.tier as ProTier,
    productId: typeof r.productId === "string" ? r.productId : "",
    expiresAt: typeof r.expiresAt === "string" && r.expiresAt ? r.expiresAt : null,
    grantedAt: typeof r.grantedAt === "string" ? r.grantedAt : "",
    isTrial: r.isTrial === true,
    willRenew: r.willRenew !== false,
    inGracePeriod: r.inGracePeriod === true,
  };
}

/** Persist a record (write-through to the durable native mirror — losing a purchase the player paid
 *  for is unacceptable, and WKWebView localStorage is OS-evictable). */
export function setProRecord(rec: ProRecord): void {
  const json = JSON.stringify(rec);
  try {
    localStorage.setItem(PRO_KEY, json);
  } catch {
    /* storage unavailable — the in-memory session still has Pro; the next sync re-writes it */
  }
  mirrorToNative(PRO_KEY, json);
  notifyProChanged();
}

/** Drop the record. Called when the store confirms there is NO entitlement (a genuine lapse), and
 *  by dev tooling / tests. A transient store failure must NEVER reach this — see `syncPro`. */
export function clearProRecord(): void {
  try {
    localStorage.removeItem(PRO_KEY);
  } catch {
    /* ignore */
  }
  mirrorToNative(PRO_KEY, null);
  notifyProChanged();
}

/** Build a record from a freshly-confirmed store grant. `grantedAt` is stamped now, which is what
 *  anchors the bounded offline window for a store that returned no expiry. */
export function proRecordFrom(
  input: { tier: ProTier; productId: string; expiresAt?: string | null; isTrial?: boolean; willRenew?: boolean; inGracePeriod?: boolean },
  now: number = Date.now(),
): ProRecord {
  return {
    tier: input.tier,
    productId: input.productId,
    expiresAt: input.expiresAt || null,
    grantedAt: new Date(now).toISOString(),
    isTrial: input.isTrial === true,
    willRenew: input.willRenew !== false,
    inGracePeriod: input.inGracePeriod === true,
  };
}

/* ─────────────────────────────  EXPIRY (the money-critical part)  ───────────────────────────── */

/** True when a record no longer entitles the user. Exported for tests — every branch matters. */
export function isRecordExpired(rec: ProRecord, now: number = Date.now()): boolean {
  // Non-expiring by IDENTITY. Never infer this from a missing date.
  if (NON_EXPIRING.has(rec.tier)) return false;

  if (rec.expiresAt != null) {
    const ms = new Date(rec.expiresAt).getTime();
    // Unparseable expiry → expired. Without this, NaN comparisons silently grant permanent Pro.
    if (!Number.isFinite(ms)) return true;
    return ms < now;
  }

  // Recurring tier, no expiry from the store. Trust it only within a bounded window anchored on
  // when we wrote it; with no usable anchor (hand-edited save, pre-`grantedAt` record) we can
  // verify nothing, so treat it as expired and let the store be the judge.
  const anchor = rec.grantedAt ? new Date(rec.grantedAt).getTime() : NaN;
  if (!Number.isFinite(anchor)) return true;
  return anchor + UNANCHORED_WINDOW_MS[rec.tier] < now;
}

/** THE entitlement check. Everything gated on Pro reads this and nothing else. */
export function isPro(now: number = Date.now()): boolean {
  const rec = getProRecord();
  return rec != null && !isRecordExpired(rec, now);
}

/** True while the user is inside their introductory free trial (and it hasn't lapsed). */
export function isOnTrial(now: number = Date.now()): boolean {
  const rec = getProRecord();
  return rec != null && rec.isTrial && !isRecordExpired(rec, now);
}

/** Whole days left on an active trial, rounded UP so a partial day still reads "1 day left".
 *  0 when not on a trial, or when the store gave us no expiry to count down to. */
export function trialDaysRemaining(now: number = Date.now()): number {
  const rec = getProRecord();
  if (!rec || !rec.isTrial || isRecordExpired(rec, now) || !rec.expiresAt) return 0;
  const ms = new Date(rec.expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** A one-line, human summary of standing for the Settings row. Never invents certainty it lacks. */
export function proStatusLine(now: number = Date.now()): string {
  const rec = getProRecord();
  if (!rec || isRecordExpired(rec, now)) return "Not subscribed";
  if (rec.tier === "founding") return "Founding Owner — Pro forever, thank you";
  if (rec.tier === "lifetime") return "Pro Lifetime — owned forever";
  if (rec.inGracePeriod) return "Pro active — there's a billing problem with your Apple ID";
  if (rec.isTrial) {
    const d = trialDaysRemaining(now);
    return d > 0 ? `Free trial — ${d} day${d === 1 ? "" : "s"} left` : "Free trial — ends today";
  }
  const label = rec.tier === "yearly" ? "Pro Yearly" : "Pro Monthly";
  if (!rec.willRenew) {
    const until = rec.expiresAt ? ` until ${new Date(rec.expiresAt).toLocaleDateString()}` : "";
    return `${label} — cancelled, active${until}`;
  }
  const renews = rec.expiresAt ? ` · renews ${new Date(rec.expiresAt).toLocaleDateString()}` : "";
  return `${label}${renews}`;
}

/* ─────────────────────────────  GRANDFATHERING  ───────────────────────────── */

/** The FIRST build shipped as a free download. Anyone whose original download was an EARLIER build
 *  paid for the app up front and is granted Pro forever — a "Founding Owner".
 *
 *  ⚠ Set this to the CFBundleVersion of the build that flips the App Store price to Free, and never
 *  lower it afterwards. Too low and paying customers silently lose what they bought; too high and
 *  new free downloads get Pro for nothing. The current paid builds are 1–4, so the first free build
 *  must be 5 or higher. */
export const FIRST_FREE_BUILD = 5;

/** True when a build number belongs to the paid era. Pure — the Swift side supplies the number. */
export function isFoundingBuild(originalBuild: number | undefined | null): boolean {
  if (typeof originalBuild !== "number" || !Number.isFinite(originalBuild)) return false;
  return originalBuild > 0 && originalBuild < FIRST_FREE_BUILD;
}

/** Grant the permanent Founding Owner entitlement. Idempotent: never downgrades an existing
 *  lifetime/founding record, and never overwrites a live paid subscription with a weaker one. */
export function grantFounding(now: number = Date.now()): void {
  const rec = getProRecord();
  if (rec && NON_EXPIRING.has(rec.tier)) return;
  setProRecord(proRecordFrom({ tier: "founding", productId: "", expiresAt: null }, now));
}

/* ─────────────────────────────  CHANGE NOTIFICATION  ───────────────────────────── */

/** Fired whenever the Pro record changes — a purchase, a restore, a background sync, an
 *  out-of-band Ask-to-Buy approval, or a lapse. Mounted UI subscribes so locks fall away the
 *  instant the entitlement lands, without waiting for a remount. */
export const PRO_CHANGED_EVENT = "silicon:pro-changed";

function notifyProChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(PRO_CHANGED_EVENT));
  } catch {
    /* non-DOM environment (Vitest node) — nothing to notify */
  }
}

/** Subscribe to entitlement changes. Returns an unsubscribe fn. No-op off-DOM. */
export function onProChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PRO_CHANGED_EVENT, cb);
  return () => window.removeEventListener(PRO_CHANGED_EVENT, cb);
}
