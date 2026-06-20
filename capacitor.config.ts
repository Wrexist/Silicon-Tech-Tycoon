import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — wraps the built web app (dist/) as a native iOS app.
// To generate the native project: `npm run build && npx cap add ios && npx cap sync`,
// then open ios/App/App.xcworkspace in Xcode to run on a device/simulator.
const config: CapacitorConfig = {
  appId: "com.wrexist.silicon",
  appName: "Silicon",
  webDir: "dist",
  backgroundColor: "#0f1115",
  ios: {
    // Edge-to-edge: the web layer owns the safe-area insets via env(safe-area-inset-*), so the
    // native scroll view must NOT add its own inset (that double-pads and reintroduces a top gap).
    contentInset: "never",
    backgroundColor: "#0f1115",
  },
  plugins: {
    SplashScreen: {
      // Branded splash on the game's dark background, no spinner. JS hides it the instant the
      // React tree mounts (src/native.ts) for a crisp hand-off — but launchAutoHide stays TRUE
      // as a hard safety net: if that JS hide never fires (a stalled boot, a missing plugin),
      // the OS still dismisses the splash instead of stranding the app on it forever (the bug
      // that showed an eternal splash on device). launchShowDuration is the auto-hide cap, set
      // high enough that the explicit hide wins first on a healthy boot (no flash of blank web).
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0f1115",
      showSpinner: false,
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Overlay the web view so the app's OWN themed background fills behind the bar (no native
      // colour band that reads as black over the light UI). Glyph style is re-synced to the live
      // theme at runtime in native.ts (syncStatusBar). `style` here is just the pre-React default.
      style: "DARK",
      overlaysWebView: true,
    },
  },
};

export default config;
