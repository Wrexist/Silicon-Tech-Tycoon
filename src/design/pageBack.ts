// A routed page can hold its OWN sub-views (Progress → Achievements / Vault / Mastery …). While one is
// open, the shell's back arrow and Escape should step back to the page's hub, not pop the whole page —
// otherwise the header's "<" (exit Progress), the sub-view's "Done" (back to the hub) and a third
// in-content "< Progress" link all did different things. The page registers an override while a
// sub-view is showing; the shell reads it. Module singleton + subscribe, like overlayGuard.
import { useEffect, useSyncExternalStore } from "react";

let override: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** While `onBack` is non-null, the shell's page back action runs it instead of popping the page. */
export function usePageBackOverride(onBack: (() => void) | null): void {
  useEffect(() => {
    if (!onBack) return;
    override = onBack;
    emit();
    return () => {
      if (override === onBack) { override = null; emit(); }
    };
  }, [onBack]);
}

/** The current override (the shell calls this for its back arrow and Escape). */
export function usePageBack(): (() => void) | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => override,
    () => override,
  );
}
