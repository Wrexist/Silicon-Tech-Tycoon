// App Store review moment — offered ONCE, at the player's first product launch (a genuine high
// point). The flow follows the best-practice "soft pre-ask": a branded in-game popup (ReviewPrompt)
// celebrates the ship and asks if they're enjoying the game; only if they tap "Rate" do we hand off
// to StoreKit's real prompt (requestReview). That keeps the OS's limited prompts for players who are
// actually happy — and never nags: it fires at most once per install.
//
// This module owns the TIMING + once-flag and a tiny event bus the popup subscribes to. The actual
// StoreKit request is native-only; on web/PWA every path here is a guarded no-op that never throws
// (the same bundle runs in the browser and the iOS shell).
import { Capacitor, registerPlugin } from "@capacitor/core";

interface ReviewPlugin {
  requestReview(): Promise<{ requested: boolean }>;
}

// Same native plugin as the IAP bridge (registerPlugin is idempotent for a given jsName).
let pluginRef: ReviewPlugin | null = null;
function plugin(): ReviewPlugin {
  if (!pluginRef) pluginRef = registerPlugin<ReviewPlugin>("SiliconStoreKit");
  return pluginRef;
}

// Persisted so prestige / New Game+ (or a second product) never re-triggers it. Versioned in case a
// future build wants to re-enable a single fresh prompt.
const REVIEW_FLAG = "silicon.reviewPrompted.v1";
// Let the launch "reveal" keynote play out (its sequence runs ~2.3s) before the system sheet lands —
// asking mid-celebration would step on the moment.
const PROMPT_DELAY_MS = 4500;

/** Ask iOS to (maybe) show the App Store review prompt. No-op on web; never throws. Called only
 *  after the player opts in via the ReviewPrompt popup. */
export async function requestAppStoreReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await plugin().requestReview();
  } catch {
    /* plugin absent (older build) / unavailable — ignore */
  }
}

// Tiny event bus so the mounted ReviewPrompt popup can be triggered without threading review state
// through GameState (mirrors design/launchReveal + celebrateFx). Listeners are usually just one.
type ReviewListener = () => void;
const listeners = new Set<ReviewListener>();

/** Subscribe to the "show the review moment" event; returns an unsubscribe fn. */
export function onReviewPrompt(fn: ReviewListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Offer the review moment ONCE, shortly after the first product launch — enough of a beat for the
 *  launch keynote reveal to finish first. Idempotent: the persistent flag guarantees it fires at most
 *  once per install regardless of how many times it's called (prestige / a second product never
 *  re-trigger it). Fires the popup event; the popup, not this module, decides to call StoreKit. */
export function maybePromptFirstLaunchReview(): void {
  try {
    if (localStorage.getItem(REVIEW_FLAG)) return;
    localStorage.setItem(REVIEW_FLAG, "1");
  } catch {
    return; // storage blocked (private mode etc.) — skip rather than risk a double prompt
  }
  setTimeout(() => { for (const fn of [...listeners]) fn(); }, PROMPT_DELAY_MS);
}
