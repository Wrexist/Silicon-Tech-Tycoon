// Tracks how many top-level app overlays (era modal, IPO overlay, interrupt cards) are open, so
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

// "Ready to launch" claims — a screen already SHOWING a product's live production/ready state
// (the Design Lab's integrated tracker sheet) claims the product id so the global ReadyToLaunch
// popup doesn't double-pop the same product on top of it. Claim on mount, release on close; the
// global popup treats a claimed product as seen (dismissing the sheet = "Later", the product
// stays on the Office card).
const readyClaims = new Set<string>();

/** Claim a product id; returns the matching release. Use as a useEffect body. */
export function claimReadyLaunch(id: string): () => void {
  readyClaims.add(id);
  return () => { readyClaims.delete(id); };
}

/** True while some screen is already presenting this product's ready-to-launch moment. */
export function readyLaunchClaimed(id: string): boolean {
  return readyClaims.has(id);
}
