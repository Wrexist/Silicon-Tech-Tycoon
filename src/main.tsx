import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./design/tokens.css";
import "./index.css";
import { App } from "./App.tsx";
import { initSettings, resolvedTheme } from "./state/settings.ts";
import { initNative } from "./native.ts";
import { hydrateFromNative } from "./state/nativeStore.ts";

async function boot(): Promise<void> {
  // NATIVE ONLY: restore any save/entitlement/prestige keys that WKWebView storage eviction
  // wiped, from the durable Preferences mirror — BEFORE anything reads localStorage. Resolves
  // immediately on web; on device the splash (launchAutoHide: false) covers the wait.
  await hydrateFromNative();

  initSettings();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Capacitor native init (status bar style per theme + splash hide). No-op on web, never throws.
  void initNative(resolvedTheme());

  // Register the PWA service worker for offline support — web/PWA only. Inside the Capacitor
  // shell assets are already served locally; a SW there only adds a stale-cache risk on update.
  if (!Capacitor.isNativePlatform() && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    void import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch(() => {
        /* SW registration unavailable — app still works online */
      });
  }
}

void boot();
