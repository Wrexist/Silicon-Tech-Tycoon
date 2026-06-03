// App settings (theme, sound, haptics) — a tiny external store, separate from the game save
// so preferences survive restarts/new companies. Read synchronously by sound/haptics helpers.
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export interface Settings {
  theme: ThemePref;
  sound: boolean;
  haptics: boolean;
  garage3d: boolean;
}

const KEY = "silicon.settings";
const DEFAULTS: Settings = { theme: "system", sound: true, haptics: true, garage3d: true };

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
  emit();
}

/** Apply the theme by toggling the documentElement attribute the CSS tokens key off. */
export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function initSettings(): void {
  applyTheme(current.theme);
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
