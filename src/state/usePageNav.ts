// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useRef, useState } from "react";
import { hashForPage, pageFromHash, popPage, pushPage, topPage, type PageId, type PageStack } from "./pageStack.ts";
import { useUiVersion } from "./uiVersion.ts";

/** A popstate event names a URL; the stack must become whatever that URL implies. Popping a single
 *  frame would be wrong when history moved forward, or when two pushes happened between events. */
export function nextStackForPopstate(stack: PageStack, hash: string): PageStack {
  const target = pageFromHash(hash);
  if (!target) return [];
  // Keep the frames below the target when they still lead to it, so a deep stack survives a Back
  // to a page that is still open beneath the top.
  const at = stack.lastIndexOf(target);
  return at >= 0 ? stack.slice(0, at + 1) : [target];
}

export function usePageNav(): { page: PageId | null; push: (p: PageId) => void; pop: () => void; clear: () => void } {
  // The page stack is a Silicon 2.0 feature, so it is inert unless the flag is on. Gating HERE — the
  // single source — means a stale `#/settings` (a bookmark, a pasted link, a URL left by a prior
  // flag-on session) can never make the CLASSIC build render a title-less page: with the flag off
  // `page` is always null, so every shell guard stays simple and the shipped game is unchanged.
  const enabled = useUiVersion() === "next";
  const [stack, setStack] = useState<PageStack>(() => {
    const fromHash = pageFromHash(typeof window === "undefined" ? "" : window.location.hash);
    return fromHash ? [fromHash] : [];
  });

  // The live stack, mirrored in a ref so push/pop can read it and perform their history side effect
  // OUTSIDE the state updater. React may invoke an updater more than once (StrictMode double-invokes
  // in development; concurrent rendering can re-run a discarded render), so an updater must stay
  // pure — a side effect in there would push two history entries, or step back twice.
  const ref = useRef<PageStack>(stack);
  const commit = useCallback((next: PageStack) => {
    ref.current = next;
    setStack(next);
  }, []);

  const push = useCallback((p: PageId) => {
    if (!enabled) return;
    const next = pushPage(ref.current, p);
    if (next === ref.current) return;
    commit(next);
    if (typeof window !== "undefined") window.history.pushState({ page: p }, "", hashForPage(p));
  }, [commit, enabled]);

  const pop = useCallback(() => {
    if (!enabled) return;
    const current = ref.current;
    if (current.length === 0) return;
    const next = popPage(current);
    commit(next);
    if (typeof window === "undefined") return;
    // Back is only correct when this entry is one WE pushed (it carries our state). A deep-linked
    // page is the FIRST history entry, where history.back() would leave the site.
    if (window.history.state?.page) window.history.back();
    else window.history.replaceState({}, "", hashForPage(topPage(next)));
  }, [commit, enabled]);

  // With the flag off there is no page to sync, so don't subscribe at all — a history event would
  // only schedule a pointless re-render.
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      const next = nextStackForPopstate(ref.current, window.location.hash);
      ref.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  /** Drop every page and return to the roots. A no-op when nothing is open, so it is safe to call
   *  unconditionally on a tab change (and must NOT rewrite history when there is nothing to clear). */
  const clear = useCallback(() => {
    if (ref.current.length === 0) return;
    ref.current = [];
    setStack([]);
    // The URL must stop naming a page the moment we leave it, however we got here — a pushed entry
    // carries our state, a deep-linked one does not, and leaving the stale hash behind would let a
    // later push+pop step back onto it and re-open the page the player just closed.
    if (typeof window !== "undefined") window.history.replaceState({}, "", hashForPage(null));
  }, []);

  return { page: enabled ? topPage(stack) : null, push, pop, clear };
}
