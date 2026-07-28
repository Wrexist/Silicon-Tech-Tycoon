// Paywall presentation bus + the timing rules that decide WHEN the offer is allowed to appear.
// Module singleton (not React state) so any screen can raise the paywall without prop-drilling —
// the same pattern as `design/celebrateFx.ts` and `design/launchReveal.ts`.
//
// The timing rules are the reason this is a module rather than three `useState`s: "show the offer,
// but never twice, never on top of another full-screen moment, and never to someone who already
// paid" is a policy, and a policy belongs in one testable place.
import { isPro } from "./pro.ts";
import { paywallCopy, type PaywallReason } from "./proGates.ts";

export type { PaywallReason };

/** What the paywall was raised for, plus what to do once it closes. */
export interface PaywallRequest {
  reason: PaywallReason;
  /** Ran when the player leaves WITHOUT subscribing (skip / close). */
  onDismiss?: () => void;
  /** Ran once Pro is active — the action the player was reaching for when they hit the wall. */
  onUnlocked?: () => void;
}

type Listener = (req: PaywallRequest) => void;
const listeners = new Set<Listener>();

/** Mount-side subscription — `<Paywall />` in App.tsx is the only subscriber. */
export function onPaywall(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Raise the paywall. A no-op for Pro users: `onUnlocked` fires immediately instead, so every call
 * site can be written as "gate the action, then do it" without branching on entitlement itself:
 *
 *     openPaywall({ reason: "scenario", onUnlocked: () => startScenario(id) })
 */
export function openPaywall(req: PaywallRequest): void {
  if (isPro()) {
    req.onUnlocked?.();
    return;
  }
  listeners.forEach((fn) => fn(req));
}

/** Headline copy for a reason — re-exported so overlays don't need two imports. */
export { paywallCopy };

/* ─────────────────────────────  FIRST-RUN TIMING  ───────────────────────────── */

const SEEN_KEY = "silicon.paywall.onboardingSeen";
const FIRST_LAUNCH_KEY = "silicon.paywall.firstLaunch";

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the offer simply shows again next launch, which is not a bug */
  }
}

/** Stamp (once) when this device first opened the app. Used for honest "new founder" framing and
 *  nothing else — there is no countdown, no expiring discount, no fake urgency anywhere. */
export function stampFirstLaunch(now: number = Date.now()): void {
  if (!readFlag(FIRST_LAUNCH_KEY)) writeFlag(FIRST_LAUNCH_KEY, String(now));
}

export function firstLaunchAt(): number {
  const raw = readFlag(FIRST_LAUNCH_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** True once the founding paywall has been presented on this device. */
export function onboardingPaywallSeen(): boolean {
  return readFlag(SEEN_KEY) === "1";
}

export function markOnboardingPaywallSeen(): void {
  writeFlag(SEEN_KEY, "1");
}

/**
 * Should the founding paywall be presented right now?
 *
 * Presented ONCE per device, at the end of onboarding — after the player has named their company,
 * so the offer lands on someone who has already committed a little, not on a cold splash screen.
 * That placement is deliberate on both axes: it is the highest-volume impression the app will ever
 * have (every install sees it), and it is still early enough that a subscriber gets full value from
 * day one.
 *
 * It is skippable, always. A forced paywall with no way past it fails Apple's minimum-functionality
 * bar for a free app, and — more practically — a player who cannot see the game cannot want it.
 */
export function shouldShowOnboardingPaywall(pro: boolean = isPro()): boolean {
  if (pro) return false;
  return !onboardingPaywallSeen();
}

/** Dev/test only — forget that the founding paywall was shown. */
export function resetPaywallFlags(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(FIRST_LAUNCH_KEY);
  } catch {
    /* ignore */
  }
}
