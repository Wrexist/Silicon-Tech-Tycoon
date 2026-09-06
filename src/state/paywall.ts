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
  /**
   * Show the offer even to someone who already has Pro.
   *
   * The default short-circuit is what lets every gate read as "gate the action, then do it" — but
   * it makes the paywall unreachable for the one case that legitimately targets a SUBSCRIBER: a
   * monthly subscriber moving to yearly. Without this the crossgrade button is a silent no-op.
   * Use it for nothing else; a subscriber must never be shown a wall for something they own.
   */
  force?: boolean;
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
  if (isPro() && !req.force) {
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

/* ─────────────────────────────  THE DEBUT OFFER  ─────────────────────────────
 *
 * The SECOND — and last — proactive impression of the offer.
 *
 * The founding offer is the highest-VOLUME impression the app will ever have and the lowest-INTENT
 * one: it lands on a player who has named a company and played nothing. That placement is right
 * (see `shouldShowOnboardingPaywall`), but on its own it means a single skip spends the only time
 * the app ever brings the offer up by itself, and every impression after it has to wait for the
 * player to walk into a lock.
 *
 * This is the other half. It fires once, after the company's first product ships AND lands well —
 * the first moment the game has actually demonstrated what it is. Same overlay, same skippability,
 * and it is bounded at exactly one showing per device, so the two together are two lifetime
 * unprompted impressions and never a third.
 *
 * Deliberately gated on a GOOD debut, in `LaunchReveal`: pitching a subscription over a flop reads
 * as opportunism, and a player who just watched their first device fail is the worst possible
 * audience for it.
 *
 * Note what this does NOT touch: it is raised from a UI surface on a player action (dismissing the
 * reveal), it stores its one bit in localStorage, and it never stamps `lastInterruptWeek` or any
 * other engine/save field — monetization stays out of the simulation, so the determinism pin cannot
 * see it.
 */

const DEBUT_KEY = "silicon.paywall.debutSeen";

/** True once the debut offer has been presented on this device. */
export function debutOfferSeen(): boolean {
  return readFlag(DEBUT_KEY) === "1";
}

export function markDebutOfferSeen(): void {
  writeFlag(DEBUT_KEY, "1");
}

/**
 * Should the debut offer be presented right now?
 *
 * Callers own the "was this a good first launch?" half of the decision — this owns the half that is
 * a policy: never to a subscriber, and never twice.
 */
export function shouldShowDebutOffer(pro: boolean = isPro()): boolean {
  if (pro) return false;
  return !debutOfferSeen();
}

/** Dev/test only — forget that the founding and debut paywalls were shown. */
export function resetPaywallFlags(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(FIRST_LAUNCH_KEY);
    localStorage.removeItem(DEBUT_KEY);
  } catch {
    /* ignore */
  }
}
