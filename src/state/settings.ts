// App settings (theme, sound, haptics) — a tiny external store, separate from the game save
// so preferences survive restarts/new companies. Read synchronously by sound/haptics helpers.
import { useSyncExternalStore } from "react";
import { syncStatusBar } from "../native.ts";
import type { InterruptPace } from "./gameState.ts";

export type ThemePref = "system" | "light" | "dark";
export interface Settings {
  theme: ThemePref;
  sound: boolean;
  haptics: boolean;
  /** Accessibility: high-contrast mode — stronger borders, muted text, and focus rings on top of the
   *  current theme (a preference, so it survives a new company — not in the game save). */
  highContrast: boolean;
  /** First-run Decorate tutorial: shown once the first time the player opens Decorate, then
   *  remembered here (a UI preference, so it survives a new company — not in the game save). */
  decorateTutorialSeen: boolean;
  /** First-run Factory tutorial: shown once the first time the player opens Factory mode, then
   *  remembered here (a UI preference, so it survives a new company — not in the game save). */
  factoryTutorialSeen: boolean;
  /** Opt-in daily-challenge reminder (native local notification, 10:00 local). Off by default. */
  dailyReminder: boolean;
  /** Whether the one-time "enable reminders?" opt-in has been shown at game start (native only), so
   *  it asks exactly once. Independent of `dailyReminder` (declining still counts as prompted). */
  notifPrompted: boolean;
  /** Calm Mode — how often the game may interrupt with opportunistic full-screen cards. Persisted here
   *  (survives a new company) and seeded into each game's state, which the pure sim reads. Default
   *  "standard" keeps the built-in cadence. */
  interruptPace: InterruptPace;
  /** Accessibility: text scale as a PERCENT of the default root font size (100 = unchanged). The whole
   *  type scale is rem-based (tokens.css), so this one number resizes every label in the app. Persisted
   *  here so it survives a new company. */
  textScale: number;
}

const KEY = "silicon.settings";
const DEFAULTS: Settings = { theme: "system", sound: true, haptics: true, highContrast: false, decorateTutorialSeen: false, factoryTutorialSeen: false, dailyReminder: false, notifPrompted: false, interruptPace: "standard", textScale: 100 };
/** Legal text-scale steps (percent). Anything else read from storage snaps to the nearest step. */
export const TEXT_SCALES = [85, 100, 115, 130] as const;

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
      // Snap a corrupt/foreign textScale to the nearest legal step (never 0/negative/huge).
      if (!TEXT_SCALES.includes(s.textScale as (typeof TEXT_SCALES)[number])) {
        s.textScale = TEXT_SCALES.reduce((best, v) =>
          Math.abs(v - s.textScale) < Math.abs(best - s.textScale) ? v : best,
        );
      }
      return s;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

let current: Settings = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  if (patch.theme !== undefined) applyTheme(current.theme);
  if (patch.highContrast !== undefined) applyContrast(current.highContrast);
  if (patch.textScale !== undefined) applyTextScale(current.textScale);
  emit();
}

/** The theme actually in effect right now ("system" resolved against the OS preference). */
export function resolvedTheme(): "light" | "dark" {
  if (current.theme !== "system") return current.theme;
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Apply the theme by toggling the documentElement attribute the CSS tokens key off, and keep
 *  the native status bar glyphs in sync (pre-fix it was hardcoded dark at boot — light-theme
 *  devices, the default, got light glyphs over a light UI on every screen). */
export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  void syncStatusBar(resolvedTheme());
}

/** Apply the high-contrast preference by toggling the attribute the CSS tokens key off. */
function applyContrast(high: boolean): void {
  const root = document.documentElement;
  if (high) root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
}

/** Apply the text-scale preference: one inline font-size on <html> resizes every rem-based label
 *  in the app. 100 clears the override so the stylesheet's default stands. */
export function applyTextScale(scale: number): void {
  const root = document.documentElement;
  if (scale === 100) root.style.removeProperty("font-size");
  else root.style.setProperty("font-size", `${scale}%`);
}

export function initSettings(): void {
  applyTheme(current.theme);
  applyContrast(current.highContrast);
  applyTextScale(current.textScale);
  // Follow live OS theme changes while the pref is "system" (also re-syncs the status bar).
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (current.theme === "system") applyTheme("system");
    });
  } catch {
    /* matchMedia events unsupported — theme still applies on next launch */
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}
