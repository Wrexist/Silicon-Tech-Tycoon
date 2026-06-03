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
      // Short branded splash on the game's dark background, no spinner. We hide it from JS
      // (src/native.ts) as soon as the React tree mounts, so keep autoHide off there.
      launchShowDuration: 600,
      launchAutoHide: false,
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
