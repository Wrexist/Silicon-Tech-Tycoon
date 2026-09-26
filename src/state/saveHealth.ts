import { useSyncExternalStore } from "react";

type SaveIssue = "write" | "native" | "recovery";
const issues = new Map<SaveIssue, string>();
const listeners = new Set<() => void>();
let message = "";

export function setSaveIssue(key: SaveIssue, value: string): void {
  if (value) issues.set(key, value); else issues.delete(key);
  const next = [...issues.values()].join(" ");
  if (next === message) return;
  message = next;
  for (const fn of listeners) fn();
}

export function getSaveHealth(): string { return message; }

export function useSaveHealth(): string {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getSaveHealth, () => "");
}
