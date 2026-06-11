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

/** Posted by the PLAYING context when it truly goes away (pagehide), so a frozen tab can recover
 *  without the player hunting for the reload button. Blocked tabs never post this — closing a
 *  stale background tab must not steal play from the active one. */
interface ReleaseMessage {
  type: "release";
  id: string;
}

export interface TabGuard {
  dispose(): void;
  /** Post a release as if this context's pagehide fired (no-op when this context is blocked).
   *  Production uses the internal pagehide listener; this is the test seam (node has no window). */
  releaseNow(): void;
}

/**
 * Claim play for this context and start listening for rival claims. `onBlocked` fires (at most
 * once per guard) when ANOTHER context claims — the caller must freeze the sim and all saves.
 * `onReleased` fires on a frozen guard when the playing context goes away (its pagehide), so the
 * caller can recover (e.g. reload into the freshest save) instead of staying frozen forever.
 * @param contextId test seam — lets one process simulate two contexts; production uses CONTEXT_ID.
 */
export function createTabGuard(
  onBlocked: () => void,
  contextId: string = CONTEXT_ID,
  onReleased?: () => void,
): TabGuard {
  if (typeof BroadcastChannel === "undefined") return { dispose() {}, releaseNow() {} };

  let blocked = false;
  let ch: BroadcastChannel;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return { dispose() {}, releaseNow() {} };
  }

  ch.onmessage = (e: MessageEvent) => {
    const msg = e?.data as ClaimMessage | ReleaseMessage | undefined;
    if (!msg || msg.id === contextId) return;
    if (!blocked && msg.type === "claim") {
      blocked = true;
      onBlocked();
    } else if (blocked && msg.type === "release") {
      onReleased?.();
    }
  };
  try {
    ch.postMessage({ type: "claim", id: contextId } satisfies ClaimMessage);
  } catch {
    /* a failed claim only means an older tab won't freeze — same as pre-guard behaviour */
  }

  // Only the context that still owns play releases on the way out. Tied to pagehide directly
  // (NOT dispose) so StrictMode's interim effect cleanup can't broadcast a spurious release.
  const releaseNow = () => {
    if (blocked) return;
    try {
      ch.postMessage({ type: "release", id: contextId } satisfies ReleaseMessage);
    } catch {
      /* lost release only means the frozen tab keeps its reload CTA — the pre-release behaviour */
    }
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", releaseNow);

  return {
    dispose() {
      if (typeof window !== "undefined") window.removeEventListener("pagehide", releaseNow);
      try {
        ch.close();
      } catch {
        /* already closed */
      }
    },
    releaseNow,
  };
}
