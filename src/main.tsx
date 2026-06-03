import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/tokens.css";
import "./index.css";
import { App } from "./App.tsx";
import { initSettings } from "./state/settings.ts";
import { initNative } from "./native.ts";

initSettings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Capacitor native init (status bar + splash). No-op on web/PWA, never throws.
void initNative();

// Register the PWA service worker for offline support. Guarded so it's a no-op where
// service workers are unsupported (or inside the Capacitor native webview, which already
// serves assets locally and doesn't need a SW). Only caches same-origin local assets —
// no runtime network beyond the app's own files.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* SW registration unavailable — app still works online */
    });
}
