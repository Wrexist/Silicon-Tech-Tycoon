import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./design/tokens.css";
import "./index.css";
import { App } from "./App.tsx";
import { initSettings, resolvedTheme } from "./state/settings.ts";
import { initNative } from "./native.ts";
import { hydrateFromNative } from "./state/nativeStore.ts";
import { refreshDailyReminders } from "./state/notifications.ts";

async function boot(): Promise<void> {
  // NATIVE ONLY: restore any save/entitlement/prestige keys that WKWebView storage eviction
  // wiped, from the durable Preferences mirror — BEFORE anything reads localStorage. Resolves
  // immediately on web. Cap the wait: a stalled native bridge here must never block first paint,
  // or the app hangs on the splash. Worst case the timeout wins and a just-evicted save is
  // restored on the next launch instead — far better than an unbootable app.
  await Promise.race([
    hydrateFromNative().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 1200)),
  ]);

  initSettings();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Capacitor native init (status bar style per theme + splash hide). No-op on web, never throws.
  void initNative(resolvedTheme());

  // Keep the opted-in daily-challenge reminder window topped up (next 7 days, real mutator names).
  // No-op on web or while the preference is off; best-effort, never blocks boot.
  void refreshDailyReminders();

  // Hand the boot splash off to the live app: complete the loading bar, hold a brief minimum so the
  // intro never flashes, then fade it out. Lives here (not in the splash) so it only clears once
  // React has actually mounted and painted the first screen underneath.
  removeBootSplash();

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

/** Finish + dismiss the inline boot splash (index.html). Snaps the loading bar to 100%, holds a
 *  ~900ms minimum from first paint so the intro reads as deliberate rather than a flash, then fades
 *  the overlay out and removes it. Safe no-op if the element is already gone. */
function removeBootSplash(): void {
  const el = document.getElementById("boot");
  if (!el) return;
  const fill = el.querySelector<HTMLElement>(".boot__bar-fill");
  if (fill) { fill.style.animation = "none"; fill.style.transform = "scaleX(1)"; }
  const start = (window as unknown as { __bootStart?: number }).__bootStart ?? 0;
  const elapsed = ((window.performance && performance.now) ? performance.now() : Date.now()) - start;
  const hold = Math.max(220, 900 - elapsed); // let the bar visibly complete before fading
  window.setTimeout(() => {
    el.classList.add("boot--done");
    window.setTimeout(() => el.remove(), 480); // after the fade transition
  }, hold);
}

void boot();
