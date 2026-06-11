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
    contentInset: "always",
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
      // Dark style = light glyphs over the dark app background. Don't overlay the web view.
      style: "DARK",
      backgroundColor: "#0f1115",
      overlaysWebView: false,
    },
  },
};

export default config;
