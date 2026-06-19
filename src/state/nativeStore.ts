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

/** The keys worth a durable copy: the save, the paid entitlement, and prestige. */
const MIRROR_KEYS = ["silicon.save.v1", "silicon.iap.sandbox", "silicon.legacy", "silicon.scenarioStars.v1", "silicon.challengeBests.v1", "silicon.museum.v1"] as const;

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
  try {
    const p = await prefs();
    if (!p) return;
    for (const key of MIRROR_KEYS) {
      try {
        if (localStorage.getItem(key) != null) continue;
        const { value } = await p.get({ key });
        if (value != null) localStorage.setItem(key, value);
      } catch {
        /* per-key: storage unavailable or quota — skip, the app still boots */
      }
    }
  } catch {
    /* plugin unavailable — boot proceeds exactly as before the mirror existed */
  }
}
