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
import { stampFirstLaunch } from "./state/paywall.ts";

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

  // Stamp this device's first-ever launch (once). Used only for honest "new founder" framing —
  // there is no countdown, no expiring discount, and no fake scarcity anywhere in the app.
  stampFirstLaunch();

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

  // ...and again on every FOREGROUND. The window is only 7 days long, so a phone that keeps the app
  // resident (iOS suspends rather than terminates) could go a fortnight without a cold launch and
  // silently run dry — boot-only refresh was the one path that could starve an opted-in player.
  // Re-scheduling is idempotent: ids are the calendar day (YYYYMMDD), so a refresh REPLACES the
  // window rather than stacking a second one. No-op on web and while the preference is off.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshDailyReminders();
  });

  // Hand the boot splash off to the live app: complete the loading bar, hold a brief minimum so the
  // intro never flashes, then fade it out. Lives here (not in the splash) so it only clears once
  // React has actually mounted and painted the first screen underneath.
  removeBootSplash();

  // A deployed update replaces every hashed chunk, and `autoUpdate` lets the new service worker
  // take over immediately (skipWaiting + clientsClaim). A tab that was already open still holds the
  // OLD chunk names, so the first lazy screen it opens after that swap 404s. The per-surface error
  // boundaries keep that from crashing the app, but the screen still would not open until a manual
  // reload. Vite fires `vite:preloadError` for exactly this; reload once to pick up the new manifest.
  // Guarded by a session flag so a genuinely broken deploy degrades to the boundaries instead of
  // reload-looping the player.
  window.addEventListener("vite:preloadError", () => {
    let alreadyTried = true; // if sessionStorage is unavailable, do NOT reload — looping is worse
    try {
      alreadyTried = sessionStorage.getItem("silicon.chunkReload") === "1";
      if (!alreadyTried) sessionStorage.setItem("silicon.chunkReload", "1");
    } catch { /* storage blocked — fall through without reloading */ }
    if (!alreadyTried) window.location.reload();
  });

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

// A throw anywhere in `boot()` before React mounts had no handler at all: `void boot()` swallowed the
// rejection, `removeBootSplash()` never ran, and the inline splash from index.html stayed on screen
// forever — a frozen logo and a loading bar stuck at 90%, with no message, no reload affordance and
// nothing in the UI to say the app had failed. (The root ErrorBoundary cannot help here; it only
// exists once React has mounted.) Boot failures are rare but real on device: a wedged native bridge,
// a browser that throws on any storage access in private mode, a partially-installed PWA. Whatever
// the cause, the player must get an explanation and a way out rather than an infinite splash.
void boot().catch(showBootFailure);

/** Last-resort boot failure screen. Deliberately written with raw DOM and inline styles: React, the
 *  design tokens and the stylesheets are all things that may be exactly what failed to load, so this
 *  must not depend on any of them. Offers Reload first (fixes every transient cause) and, behind a
 *  second tap, a full reset for a save that cannot be loaded at all. */
function showBootFailure(err: unknown): void {
  // eslint-disable-next-line no-console
  console.error("Silicon failed to start:", err);
  const splash = document.getElementById("boot");
  if (splash) splash.remove();
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const host = document.getElementById("root") ?? document.body;
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.setAttribute("role", "alert");
  wrap.style.cssText =
    "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "gap:16px;padding:32px;text-align:center;background:#0b0e14;color:#e6ecf5;" +
    "font:15px/1.5 -apple-system,'Segoe UI',system-ui,sans-serif";
  const h = document.createElement("h1");
  h.textContent = "Silicon couldn't start";
  h.style.cssText = "margin:0;font-size:20px;font-weight:650";
  const p = document.createElement("p");
  p.textContent = "Something went wrong while loading. Your company is still saved on this device.";
  p.style.cssText = "margin:0;max-width:34ch;opacity:0.75";
  const detail = document.createElement("code");
  detail.textContent = msg;
  detail.style.cssText =
    "max-width:90vw;overflow-wrap:anywhere;font-size:12px;opacity:0.6;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06)";
  const reload = document.createElement("button");
  reload.textContent = "Reload";
  reload.style.cssText =
    "appearance:none;border:0;border-radius:12px;padding:12px 28px;font:inherit;font-weight:600;" +
    "background:#3b82f6;color:#fff;cursor:pointer";
  reload.onclick = () => window.location.reload();
  const reset = document.createElement("button");
  reset.textContent = "Reset the game";
  reset.style.cssText =
    "appearance:none;border:0;border-radius:12px;padding:10px 20px;font:inherit;background:transparent;" +
    "color:#e6ecf5;opacity:0.65;cursor:pointer";
  // Two taps, like the in-app crash card: Reload fixes almost everything, and this is destructive.
  let armed = false;
  reset.onclick = () => {
    if (!armed) {
      armed = true;
      reset.textContent = "Tap again to delete your save";
      reset.style.color = "#f87171";
      reset.style.opacity = "1";
      return;
    }
    // Same clearer the in-app crash card uses, so "reset" means one thing across both surfaces
    // (it also clears the durable native mirror — otherwise the bad save resurrects on next launch).
    void import("./state/persistence.ts")
      .then((m) => m.clearSave())
      .catch(() => {
        /* module unavailable — fall through to the reload anyway */
      })
      .finally(() => window.location.reload());
  };
  wrap.append(h, p, detail, reload, reset);
  host.append(wrap);
}
