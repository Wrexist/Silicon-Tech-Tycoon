// App settings (theme, sound, haptics) — a tiny external store, separate from the game save
// so preferences survive restarts/new companies. Read synchronously by sound/haptics helpers.
import { useSyncExternalStore } from "react";
import { syncStatusBar } from "../native.ts";

export type ThemePref = "system" | "light" | "dark";
export interface Settings {
  theme: ThemePref;
  sound: boolean;
  haptics: boolean;
  garage3d: boolean;
  /** Accessibility: high-contrast mode — stronger borders, muted text, and focus rings on top of the
   *  current theme (a preference, so it survives a new company — not in the game save). */
  highContrast: boolean;
  /** First-run Decorate tutorial: shown once the first time the player opens Decorate, then
   *  remembered here (a UI preference, so it survives a new company — not in the game save). */
  decorateTutorialSeen: boolean;
  /** Opt-in daily-challenge reminder (native local notification, 10:00 local). Off by default. */
  dailyReminder: boolean;
}

const KEY = "silicon.settings";
const DEFAULTS: Settings = { theme: "system", sound: true, haptics: true, garage3d: true, highContrast: false, decorateTutorialSeen: false, dailyReminder: false };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
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
export function applyContrast(high: boolean): void {
  const root = document.documentElement;
  if (high) root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
}

export function initSettings(): void {
  applyTheme(current.theme);
  applyContrast(current.highContrast);
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
