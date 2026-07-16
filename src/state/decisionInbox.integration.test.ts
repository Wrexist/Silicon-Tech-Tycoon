// Decision Inbox flow contract: a lone low-stakes interrupt is routed to the banner and is never
// blocked from resolving. This composes the exact predicates the banner + overlays use so the
// banner→open→resolve path can't soft-lock (a pending that no surface can show would freeze the game,
// since noPendingInterrupt would block every other interrupt behind it).
import { describe, it, expect } from "vitest";
import { newGame, type GameState } from "./gameState.ts";
import { inboxPendingKey, higherPriorityPending, isInboxInterrupt } from "../design/interruptPriority.ts";

// A live company with one low-stakes interrupt pending and nothing else competing.
function withPostLaunch(): GameState {
  return {
    ...newGame(1),
    pendingPostLaunch: { week: 5, productId: "p", productName: "P", kind: "stall", title: "t", body: "b", options: [{ label: "ok", blurb: "", effect: {} }] },
  } as unknown as GameState;
}

describe("decision inbox flow", () => {
  it("a lone low-stakes pending is an inbox item and is NOT blocked by anything", () => {
    const s = withPostLaunch();
    const key = inboxPendingKey(s);
    expect(key).toBe("postLaunch");
    expect(isInboxInterrupt(key!)).toBe(true);
    // Nothing higher-priority is up (no launch, no takeover), so the banner shows and — once opened —
    // the overlay shows. This is the anti-soft-lock guarantee.
    expect(higherPriorityPending(s, key!)).toBe(false);
  });

  it("banner vs overlay visibility composes correctly with the open flag", () => {
    const s = withPostLaunch();
    const key = inboxPendingKey(s)!;
    const blocked = higherPriorityPending(s, key); // false here
    // Banner shows when a decision waits and it's NOT opened yet.
    const bannerVisible = (open: boolean) => key != null && !open && !blocked;
    // The overlay (for a no-outcome stream) shows only when opened.
    const overlayVisible = (open: boolean) => s.pendingPostLaunch != null && open && !blocked;
    expect(bannerVisible(false)).toBe(true);
    expect(overlayVisible(false)).toBe(false);
    // After the player taps Review (open = true): banner hides, overlay shows — exactly one surface.
    expect(bannerVisible(true)).toBe(false);
    expect(overlayVisible(true)).toBe(true);
  });

  it("no low-stakes pending → no inbox item (banner stays hidden)", () => {
    expect(inboxPendingKey(newGame(1))).toBeNull();
  });
});
