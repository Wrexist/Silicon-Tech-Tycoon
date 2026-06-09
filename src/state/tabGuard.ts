// Multi-tab single-writer guard — closes the one real save-loss path on web (v9 audit).
// Two browser contexts running the same save each tick the sim AND autosave every few seconds,
// so last-writer-wins silently destroys whichever tab the player was actually using (and the
// doubled burn surfaces as spurious bankruptcies in side-by-side previews).
//
// Takeover semantics: every new context broadcasts a claim on boot; any OTHER context that hears
// a claim freezes (stops ticking and — critically — stops saving) behind a "playing elsewhere"
// overlay with a reload CTA. Reloading re-boots from the freshest save and claims back. The
// existing visibility-change save means the handoff is near-lossless: switching tabs saves the
// old tab at the moment it hides, and the new tab boots from that save.
//
// Native (Capacitor) has a single webview, so the guard simply never fires there. Contexts with
// partitioned storage (e.g. iOS standalone PWA vs Safari) don't share the save OR the channel,
// so they can't clobber each other and don't need guarding. Where BroadcastChannel is missing
// (legacy engines), behaviour degrades to exactly what shipped before — no regression.
const CHANNEL_NAME = "silicon.tab.v1";

/** One id per CONTEXT (not per guard instance): StrictMode mounts the guard effect twice, and
 *  both instances must recognise each other's messages as "self" or dev would self-freeze. */
const CONTEXT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

interface ClaimMessage {
  type: "claim";
  id: string;
}

export interface TabGuard {
  dispose(): void;
}

/**
 * Claim play for this context and start listening for rival claims. `onBlocked` fires (at most
 * once per guard) when ANOTHER context claims — the caller must freeze the sim and all saves.
 * @param contextId test seam — lets one process simulate two contexts; production uses CONTEXT_ID.
 */
export function createTabGuard(onBlocked: () => void, contextId: string = CONTEXT_ID): TabGuard {
  if (typeof BroadcastChannel === "undefined") return { dispose() {} };

  let blocked = false;
  let ch: BroadcastChannel;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return { dispose() {} };
  }

  ch.onmessage = (e: MessageEvent) => {
    const msg = e?.data as ClaimMessage | undefined;
    if (!blocked && msg?.type === "claim" && msg.id !== contextId) {
      blocked = true;
      onBlocked();
    }
  };
  try {
    ch.postMessage({ type: "claim", id: contextId } satisfies ClaimMessage);
  } catch {
    /* a failed claim only means an older tab won't freeze — same as pre-guard behaviour */
  }

  return {
    dispose() {
      try {
        ch.close();
      } catch {
        /* already closed */
      }
    },
  };
}
