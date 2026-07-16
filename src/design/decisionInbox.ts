// Decision Inbox bus — whether the player has OPENED the currently-waiting low-stakes decision for
// full view. The low-stakes interrupt overlays (staff / community / regional / post-launch) no longer
// seize the screen the instant their card is raised; instead the <DecisionInbox/> banner (mounted once
// in App) shows that something's waiting, and only when the player taps "Review" does the matching
// overlay open. Module singleton, same fire-and-forget pattern as launchReveal — no prop drilling.
//
// Presentation only: the engine still raises the same pending* fields on the same cadence; this just
// changes WHEN their overlay appears. So determinism is untouched.
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Is the waiting decision currently opened for full view? */
export function isDecisionOpen(): boolean {
  return open;
}

/** Open the waiting decision's overlay (from the banner's Review button). */
export function openDecision(): void {
  if (open) return;
  open = true;
  emit();
}

/** Close/reset — called when the decision resolves (its pending clears) so the NEXT one shows as a
 *  banner again rather than auto-opening. Idempotent. */
export function closeDecision(): void {
  if (!open) return;
  open = false;
  emit();
}

export function onDecisionOpenChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React binding — re-renders the caller when the open/closed state flips. */
export function useDecisionOpen(): boolean {
  return useSyncExternalStore(onDecisionOpenChange, isDecisionOpen, isDecisionOpen);
}
