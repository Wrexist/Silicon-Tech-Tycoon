// Native-platform init (Capacitor only). On web/PWA every call here is a guarded no-op
// and must never throw — the same bundle runs in the browser and inside the iOS shell.
import { Capacitor } from "@capacitor/core";

/** Keep the iOS status bar glyphs readable on the CURRENT theme. Style.Dark = light glyphs
 *  (for the dark UI), Style.Light = dark glyphs (for the light UI — the default on most
 *  devices, where a hardcoded dark bar read as light-on-light). Called at boot and again on
 *  every theme change (settings.applyTheme). No-op on web. */
export async function syncStatusBar(resolved: "light" | "dark"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: resolved === "dark" ? Style.Dark : Style.Light }).catch(() => {});
  } catch {
    /* plugin absent — ignore */
  }
}

export async function initNative(resolvedTheme: "light" | "dark"): Promise<void> {
  // Only touch native plugins when actually running inside the Capacitor container.
  if (!Capacitor.isNativePlatform()) return;
  try {
    await syncStatusBar(resolvedTheme);
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Hide the splash now that the React tree has mounted.
    await SplashScreen.hide().catch(() => {});
  } catch {
    /* native plugins absent / unavailable — ignore, app still runs */
  }
}
