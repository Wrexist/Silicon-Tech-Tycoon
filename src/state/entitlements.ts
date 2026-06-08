// Device-level IAP entitlements — what the player OWNS, persisted separately from the game save
// (like legacy.ts) so it survives new games, restarts, and save imports. The one v1 IAP is the
// Sandbox / Creative-mode unlock; the base game itself is a paid ($8.99 premium) download handled
// by the App Store, so it needs no in-app entitlement. PURE-ish (localStorage only, mockable).
const SANDBOX_KEY = "silicon.iap.sandbox";

/** True once the player owns the Sandbox / Creative-mode unlock (purchased or restored). */
export function hasSandboxEntitlement(): boolean {
  try {
    return localStorage.getItem(SANDBOX_KEY) === "1";
  } catch {
    return false;
  }
}

/** Grant the Sandbox entitlement (called after a successful purchase or restore). */
export function grantSandboxEntitlement(): void {
  try {
    localStorage.setItem(SANDBOX_KEY, "1");
  } catch {
    /* ignore — storage unavailable */
  }
}

/** Revoke the entitlement. Only used by dev tooling / tests — never in normal play. */
export function clearSandboxEntitlement(): void {
  try {
    localStorage.removeItem(SANDBOX_KEY);
  } catch {
    /* ignore */
  }
}
