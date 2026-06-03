// Native-platform init (Capacitor only). On web/PWA every call here is a guarded no-op
// and must never throw — the same bundle runs in the browser and inside the iOS shell.
import { Capacitor } from "@capacitor/core";

export async function initNative(): Promise<void> {
  // Only touch native plugins when actually running inside the Capacitor container.
  if (!Capacitor.isNativePlatform()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);
    // Dark style = light glyphs, which read on the app's dark (#0f1115) background.
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    // Hide the splash now that the React tree has mounted.
    await SplashScreen.hide().catch(() => {});
  } catch {
    /* native plugins absent / unavailable — ignore, app still runs */
  }
}
