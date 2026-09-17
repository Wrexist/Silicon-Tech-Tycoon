// UI version — which chrome the app renders. "classic" is the shipped game and the default;
// "next" opts into the Silicon 2.0 shell. Its own store (like settings) so it survives restarts,
// and resolvable from a URL param so the screenshot harness can flip it without touching storage.
import { useSyncExternalStore } from "react";

export type UiVersion = "classic" | "next";

const KEY = "silicon.ui2";

function normalise(v: string | null): UiVersion | null {
  if (v === null) return null;
  const s = v.trim().toLowerCase();
  if (s === "next" || s === "1" || s === "true" || s === "2") return "next";
  if (s === "classic" || s === "0" || s === "false") return "classic";
  return null;
}

/** Pure: URL param wins over storage, storage wins over the default. Every absent or unrecognised
 *  value resolves to "classic" — the shipped game is always the safe answer. */
export function resolveUiVersion(urlParam: string | null, stored: string | null): UiVersion {
  return normalise(urlParam) ?? normalise(stored) ?? "classic";
}

function readParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("ui");
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current: UiVersion = "classic";
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function initUiVersion(): void {
  current = resolveUiVersion(readParam(), readStored());
  emit();
}

export function getUiVersion(): UiVersion {
  return current;
}

export function uiNextEnabled(): boolean {
  return current === "next";
}

export function setUiVersion(v: UiVersion): void {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable — the in-memory value still applies for this session */
  }
  emit();
}

export function useUiVersion(): UiVersion {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}
