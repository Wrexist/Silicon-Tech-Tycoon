import { useEffect, useRef } from "react";

// Tracks the top-level app overlays (era modal, IPO overlay, interrupt cards, sheets, paywall) that are
// open, as a STACK in mount order, so exactly one layer — the frontmost — answers Escape. Every layer
// listens on `window`; before this was a stack, one Escape over the IPO overlay + the paywall raised
// from it closed BOTH (and marked the IPO seen, losing New Game+ for the run), and one Escape over an
// era-mandate draft + a strike card declined the mandate too. Lower full-screen layers — Factory mode
// and the page stack — also defer to `appOverlayOpen()`.
const stack: object[] = [];

/** Mark an app-level overlay open; returns the matching close. Use as a useEffect body:
 *  `useEffect(() => registerAppOverlay(), [])`. An overlay registered this way that has no Escape
 *  action of its own still blocks the layers beneath it from answering Escape. */
export function registerAppOverlay(): () => void {
  const token = {};
  stack.push(token);
  return () => {
    const i = stack.indexOf(token);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** True while any top-level app overlay is showing — lower layers should ignore Escape. */
export function appOverlayOpen(): boolean {
  return stack.length > 0;
}

/** Register an overlay layer while `active` and run `onEscape` on Escape — but only while this layer
 *  is the FRONTMOST one. The callback is read through a ref, so an inline arrow doesn't re-register
 *  the layer (and reshuffle the stack) on every render. */
export function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const token = {};
    stack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stack[stack.length - 1] !== token) return;
      cb.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
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
