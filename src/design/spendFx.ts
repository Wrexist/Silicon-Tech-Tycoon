// Module-level spend-event bus. Spending callbacks in useGame.tsx call emitSpend/emitRpSpend;
// GainFX subscribes and renders the floating "-$X" / "-N RP" tokens.
// Using a module singleton (not React state) so the signals are fire-and-forget with no re-renders.
import type { Money } from "../engine/money.ts";

type CashListener = (amount: Money) => void;
type RpListener = (rp: number) => void;

const cashListeners = new Set<CashListener>();
const rpListeners = new Set<RpListener>();

export function onSpend(fn: CashListener): () => void {
  cashListeners.add(fn);
  return () => cashListeners.delete(fn);
}
export function onRpSpend(fn: RpListener): () => void {
  rpListeners.add(fn);
  return () => rpListeners.delete(fn);
}

export function emitSpend(amount: Money): void {
  if (amount <= 0) return;
  cashListeners.forEach((fn) => fn(amount));
}
export function emitRpSpend(rp: number): void {
  if (rp <= 0) return;
  rpListeners.forEach((fn) => fn(rp));
}
