// Ref-counted <body> scroll lock. Several overlays (FactoryMode, the Sheet primitive, the decorate
// editor…) each want to freeze background scroll while they're up. If they each save/restore
// document.body.style.overflow independently, an inner overlay can capture the OUTER one's "hidden"
// as its "previous" value and restore *that* on close — leaking a permanent lock, so the page
// underneath never scrolls again (the "tap Research in the factory → stuck screen" bug). Routing
// every lock through this shared counter means the body stays locked until the LAST holder releases,
// regardless of mount/unmount order or how often a React effect re-runs.
let count = 0;
let saved = "";

/** Acquire a body scroll lock; returns an idempotent release fn (safe to call more than once, as a
 *  React effect cleanup may). The real overflow value is saved on the first lock and restored only
 *  when the final holder releases. */
export function lockScroll(): () => void {
  if (count === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count -= 1;
    if (count <= 0) {
      count = 0;
      document.body.style.overflow = saved;
    }
  };
}
