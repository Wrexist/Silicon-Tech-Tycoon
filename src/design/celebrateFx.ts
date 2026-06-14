// Module-level celebrate-event bus. A hit moment (e.g. a hit launch) calls emitCelebrate();
// the <Confetti /> overlay subscribes and fires a one-shot burst. Module singleton (not React
// state) so it's fire-and-forget with no re-renders, matching spendFx.ts.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onCelebrate(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitCelebrate(): void {
  listeners.forEach((fn) => fn());
}
