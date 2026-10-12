// App Store review moments — offered at up to three genuine high points: the first product launch,
// the first hit, and reaching a new era. The flow follows the best-practice "soft pre-ask": a branded
// in-game popup (ReviewPrompt) celebrates the moment and asks if they're enjoying the game; only if
// they tap "Rate" do we hand off to StoreKit's real prompt (requestReview). That keeps the OS's
// limited prompts (iOS shows at most three a year) for players who are actually happy. It never
// nags: each moment fires at most once per install, asks are at least MIN_GAP_MS apart, and once a
// player taps "Rate" we never ask again.
//
// This module owns the TIMING + once-flags and a tiny event bus the popup subscribes to. The actual
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

/** The high points worth asking at, in the order a run reaches them. */
export type ReviewMoment = "first-launch" | "first-hit" | "new-era";

// Persisted so prestige / New Game+ never re-triggers a moment. v1 was the original one-shot flag
// (first launch only); a v1 install counts that moment as already asked, long ago.
const REVIEW_FLAG_V1 = "silicon.reviewPrompted.v1";
const REVIEW_STATE = "silicon.review.v2";
/** Spacing between asks, so two high points in one sitting never become two popups. */
export const MIN_GAP_MS = 3 * 24 * 60 * 60 * 1000;
// Let the launch "reveal" keynote play out (its sequence runs ~2.3s) before the system sheet lands —
// asking mid-celebration would step on the moment.
const PROMPT_DELAY_MS = 4500;

type ReviewState = { asked: Partial<Record<ReviewMoment, number>>; rated?: boolean };

function readState(): ReviewState {
  const raw = localStorage.getItem(REVIEW_STATE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ReviewState;
      if (parsed && typeof parsed === "object" && parsed.asked && typeof parsed.asked === "object") return parsed;
    } catch { /* corrupt — fall through to a fresh state */ }
  }
  return { asked: localStorage.getItem(REVIEW_FLAG_V1) ? { "first-launch": 0 } : {} };
}
const writeState = (st: ReviewState) => localStorage.setItem(REVIEW_STATE, JSON.stringify(st));

/** The player tapped "Rate": they've been handed to StoreKit, so never ask again. Never throws. */
export function markReviewRated(): void {
  try { writeState({ ...readState(), rated: true }); } catch { /* storage blocked — nothing to keep */ }
}

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
type ReviewListener = (moment: ReviewMoment) => void;
const listeners = new Set<ReviewListener>();

/** Subscribe to the "show the review moment" event; returns an unsubscribe fn. */
export function onReviewPrompt(fn: ReviewListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Offer the review moment for `moment`, shortly after it happens. Idempotent per moment (prestige /
 *  a second product never re-trigger it), skipped once the player has rated, and spaced MIN_GAP_MS
 *  from the previous ask. Fires the popup event; the popup, not this module, calls StoreKit. */
export function maybePromptReview(moment: ReviewMoment, now = Date.now()): void {
  try {
    const st = readState();
    if (st.rated || st.asked[moment] !== undefined) return;
    const last = Math.max(-Infinity, ...Object.values(st.asked).filter((t): t is number => typeof t === "number"));
    if (now - last < MIN_GAP_MS) return;
    writeState({ ...st, asked: { ...st.asked, [moment]: now } });
    if (moment === "first-launch") localStorage.setItem(REVIEW_FLAG_V1, "1");
  } catch {
    return; // storage blocked (private mode etc.) — skip rather than risk a double prompt
  }
  setTimeout(() => { for (const fn of [...listeners]) fn(moment); }, PROMPT_DELAY_MS);
}

/** The original first-launch entry point. */
export function maybePromptFirstLaunchReview(): void {
  maybePromptReview("first-launch");
}
