// Device-level IAP entitlements — what the player OWNS, persisted separately from the game save
// (like legacy.ts) so it survives new games, restarts, and save imports. This module covers ONLY the
// legacy Creative Mode unlock, sold as a standalone IAP while the app was a paid download. That
// purchase is honoured forever and is never re-sold; Creative Mode now also travels with Silicon
// Pro, whose entitlement lives in `pro.ts`. PURE-ish (localStorage only, mockable).
// On native the PAID entitlement is also mirrored to Preferences (nativeStore) — WKWebView
// localStorage is OS-evictable, and losing a purchase the player paid for is unacceptable.
import { mirrorToNative } from "./nativeStore.ts";

const SANDBOX_KEY = "silicon.iap.sandbox";

/** True once the player owns the Sandbox / Creative-mode unlock (purchased or restored). */
export function hasSandboxEntitlement(): boolean {
  try {
    return localStorage.getItem(SANDBOX_KEY) === "1";
  } catch {
    return false;
  }
}

/** Strip a `sandboxUnlocked` flag the device isn't actually entitled to (e.g. carried in from an
 *  imported save, or a localStorage save whose entitlement was cleared) so the engine's
 *  unlimited-cash floor can never be unlocked for free. Generic over the state shape to avoid a
 *  GameState import here — entitlements stay decoupled from the engine types. */
export function withValidatedSandbox<T extends { sandboxUnlocked: boolean }>(s: T): T {
  return s.sandboxUnlocked && !hasSandboxEntitlement() ? { ...s, sandboxUnlocked: false } : s;
}

/** Grant the Sandbox entitlement (called after a successful purchase or restore). */
export function grantSandboxEntitlement(): void {
  try {
    localStorage.setItem(SANDBOX_KEY, "1");
  } catch {
    /* ignore — storage unavailable */
  }
  mirrorToNative(SANDBOX_KEY, "1");
}

/** Revoke the entitlement. Only used by dev tooling / tests — never in normal play. */
export function clearSandboxEntitlement(): void {
  try {
    localStorage.removeItem(SANDBOX_KEY);
  } catch {
    /* ignore */
  }
  mirrorToNative(SANDBOX_KEY, null);
}
