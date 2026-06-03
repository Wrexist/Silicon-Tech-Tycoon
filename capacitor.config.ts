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
};

export default config;
