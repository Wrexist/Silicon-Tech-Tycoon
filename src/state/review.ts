// App Store review prompt — asked ONCE, at the player's first product launch (a genuine high point,
// per Apple's HIG: request a rating after a positive, completed experience, never via a custom UI or
// a nagging button). The OS shows it at most a few times/year and decides whether to display at all,
// so we simply "request" at the right moment and let StoreKit do the rest.
//
// Cross-platform: native iOS calls the SiliconStoreKit plugin's requestReview; on web/PWA every path
// here is a guarded no-op that never throws (the same bundle runs in the browser and the iOS shell).
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

/** Ask iOS to (maybe) show the App Store review prompt. No-op on web; never throws. */
export async function requestAppStoreReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await plugin().requestReview();
  } catch {
    /* plugin absent (older build) / unavailable — ignore */
  }
}

/** Prompt for a review ONCE, shortly after the first product launch. Idempotent: the persistent
 *  flag guarantees it fires at most once per install regardless of how many times it's called. */
export function maybePromptFirstLaunchReview(): void {
  try {
    if (localStorage.getItem(REVIEW_FLAG)) return;
    localStorage.setItem(REVIEW_FLAG, "1");
  } catch {
    return; // storage blocked (private mode etc.) — skip rather than risk a double prompt
  }
  setTimeout(() => { void requestAppStoreReview(); }, PROMPT_DELAY_MS);
}
