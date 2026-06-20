// Native-platform init (Capacitor only). On web/PWA every call here is a guarded no-op
// and must never throw — the same bundle runs in the browser and inside the iOS shell.
import { Capacitor } from "@capacitor/core";
import { initIapListeners } from "./state/iap.ts";

/** Keep the iOS status bar glyphs readable on the CURRENT theme. Style.Dark = light glyphs
 *  (for the dark UI), Style.Light = dark glyphs (for the light UI — the default on most
 *  devices, where a hardcoded dark bar read as light-on-light). Called at boot and again on
 *  every theme change (settings.applyTheme). No-op on web.
 *
 *  We also force the bar to OVERLAY the web view: the app draws edge-to-edge (the whole CSS
 *  layer already reserves `env(safe-area-inset-top)`), so the app's own themed background fills
 *  behind the status bar. Without this the native strip falls back to its configured colour and
 *  reads as a hardcoded black band over the light UI. */
export async function syncStatusBar(resolved: "light" | "dark"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Overlay so the webview's background (not a native colour band) shows behind the bar.
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    await StatusBar.setStyle({ style: resolved === "dark" ? Style.Dark : Style.Light }).catch(() => {});
    // Android colours the bar itself (iOS ignores this under overlay) — keep it matched to the
    // app background so there's no band there either.
    await StatusBar.setBackgroundColor({ color: resolved === "dark" ? "#0f1115" : "#f4f5f7" }).catch(() => {});
  } catch {
    /* plugin absent — ignore */
  }
}

export async function initNative(resolvedTheme: "light" | "dark"): Promise<void> {
  // Only touch native plugins when actually running inside the Capacitor container.
  if (!Capacitor.isNativePlatform()) return;
  try {
    await syncStatusBar(resolvedTheme);
    // Start listening for StoreKit transactions approved out-of-band (Ask-to-Buy, Family Sharing,
    // re-downloads) so a deferred purchase grants Creative Mode the moment it clears. No-op on web.
    void initIapListeners();
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Hide the splash now that the React tree has mounted.
    await SplashScreen.hide().catch(() => {});
  } catch {
    /* native plugins absent / unavailable — ignore, app still runs */
  }
}
