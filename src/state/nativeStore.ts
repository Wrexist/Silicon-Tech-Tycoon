// Durable native mirror for the keys that must survive WKWebView storage eviction.
//
// On iOS, localStorage lives in WKWebView website data, which the OS can purge under storage
// pressure — for a premium save-centric game that's the "player loses their company" risk.
// Capacitor Preferences writes to UserDefaults, which is not purged and is included in device
// backups. Strategy: localStorage stays the synchronous source of truth (the whole state layer
// reads it sync); every write of a mirrored key is copied to Preferences fire-and-forget, and at
// boot — BEFORE anything reads localStorage — any key missing locally is restored from the
// mirror. On web every function here is an instant no-op. Nothing ever throws.
import { Capacitor } from "@capacitor/core";

/** The keys worth a durable copy: the save, the parked freeform company held while a challenge/
 *  scenario runs (so "return to your company" survives eviction), BOTH paid entitlements (the legacy
 *  Creative Mode unlock and the Silicon Pro record), and prestige. Losing the Pro record to storage
 *  eviction would lock a paying subscriber out of what they're paying for until the next successful
 *  store sync — on a plane, that's the whole flight. */
const MIRROR_KEYS = ["silicon.save.v1", "silicon.save.v1.home", "silicon.iap.sandbox", "silicon.pro.v1", "silicon.legacy", "silicon.scenarioStars.v1", "silicon.challengeBests.v1", "silicon.challengeAttempts.v1", "silicon.museum.v1", "silicon.achievements.v1", "silicon.seasons.v1"] as const;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

type PreferencesPlugin = typeof import("@capacitor/preferences").Preferences;
let prefsPromise: Promise<PreferencesPlugin | null> | null = null;
function prefs(): Promise<PreferencesPlugin | null> {
  if (!prefsPromise) {
    prefsPromise = import("@capacitor/preferences")
      .then((m) => m.Preferences)
      .catch(() => null);
  }
  return prefsPromise;
}

/** Write-through: copy a mirrored key's new value (or deletion) to Preferences. Fire-and-forget —
 *  callers are sync localStorage paths and must never wait on (or crash from) the mirror. */
export function mirrorToNative(key: string, value: string | null): void {
  if (!isNative() || !(MIRROR_KEYS as readonly string[]).includes(key)) return;
  void prefs()
    .then((p) => {
      if (!p) return;
      return value == null ? p.remove({ key }) : p.set({ key, value });
    })
    .catch(() => {
      /* a failed mirror write only costs durability, never gameplay */
    });
}

/** Boot-time restore: for each mirrored key ABSENT from localStorage but present in Preferences,
 *  copy it back. localStorage wins when both exist (it's written every 4s; the mirror trails it),
 *  so a healthy boot changes nothing — this only fires after eviction wiped WKWebView storage.
 *  Must be awaited before the first localStorage read (see main.tsx boot order). */
export async function hydrateFromNative(): Promise<void> {
  if (!isNative()) return;
  let restoredEntitlement = false;
  try {
    const p = await prefs();
    if (!p) return;
    for (const key of MIRROR_KEYS) {
      try {
        if (localStorage.getItem(key) != null) continue;
        const { value } = await p.get({ key });
        if (value != null) {
          localStorage.setItem(key, value);
          if (key === "silicon.pro.v1" || key === "silicon.iap.sandbox") restoredEntitlement = true;
        }
      } catch {
        /* per-key: storage unavailable or quota — skip, the app still boots */
      }
    }
  } catch {
    /* plugin unavailable — boot proceeds exactly as before the mirror existed */
  } finally {
    // main.tsx RACES this against a 1.2s cap so a stalled bridge can never block first paint — so
    // this can legitimately finish AFTER React has mounted and already read `isPro()` as false.
    // Without a notification a paying subscriber would sit looking at lock chips until something
    // else happened to write or the app was backgrounded. `usePro.ts` listens for this event.
    // (The string is duplicated rather than imported from `pro.ts`, which imports THIS module —
    // it must stay equal to `PRO_CHANGED_EVENT` there.)
    if (restoredEntitlement && typeof window !== "undefined") {
      try {
        window.dispatchEvent(new Event("silicon:pro-changed"));
      } catch {
        /* non-DOM environment — nothing to notify */
      }
    }
  }
}
