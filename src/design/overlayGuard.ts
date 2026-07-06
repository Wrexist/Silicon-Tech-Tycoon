// Tracks how many top-level app overlays (the offline recap, era modal, IPO overlay) are open, so
// lower full-screen layers — chiefly Factory mode — can defer their global Escape handler to the
// frontmost overlay. Without this, both listen on `window` and a single Escape dismisses the overlay
// AND falls through to close Factory mode underneath it.
let open = 0;

/** Mark an app-level overlay open; returns the matching close. Use as a useEffect body:
 *  `useEffect(() => registerAppOverlay(), [])`. */
export function registerAppOverlay(): () => void {
  open++;
  return () => { open = Math.max(0, open - 1); };
}

/** True while any top-level app overlay is showing — lower layers should ignore Escape. */
export function appOverlayOpen(): boolean {
  return open > 0;
}
