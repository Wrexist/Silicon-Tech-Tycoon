// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hashForRoute,
  popPage,
  pushPage,
  routeFromHash,
  sameFrame,
  topPage,
  type PageId,
  type PageStack,
  type RootId,
  type RouteParams,
} from "./pageStack.ts";
import { useUiVersion } from "./uiVersion.ts";

/** A popstate event names a URL; the stack must become whatever that URL implies. */
export function nextStackForPopstate(stack: PageStack, hash: string, fallbackRoot: RootId): PageStack {
  const { frame } = routeFromHash(hash, fallbackRoot);
  if (!frame) return [];
  // Keep the frames below the target when they still lead to it, so a deep stack survives a Back to
  // a page that is still open beneath the top.
  const at = stack.findIndex((f) => sameFrame(f, frame));
  return at >= 0 ? stack.slice(0, at + 1) : [frame];
}

export function usePageNav(
  currentRoot: RootId,
): { root: RootId; page: PageId | null; params: RouteParams; push: (p: PageId, params?: RouteParams) => void; pop: () => void; clear: (nextRoot?: RootId) => void } {
  // Inert unless the flag is on. Gating HERE — the single source — keeps a stale hash from ever
  // making the CLASSIC build render a page, so every shell guard stays simple.
  const enabled = useUiVersion() === "next";
  const [stack, setStack] = useState<PageStack>(() => {
    const { frame } = routeFromHash(typeof window === "undefined" ? "" : window.location.hash, currentRoot);
    return frame ? [frame] : [];
  });
  // The live stack, mirrored in a ref so push/pop read it and perform their history side effect
  // OUTSIDE the state updater (React may invoke an updater more than once).
  const ref = useRef<PageStack>(stack);
  const commit = useCallback((next: PageStack) => {
    ref.current = next;
    setStack(next);
  }, []);

  const push = useCallback((p: PageId, params: RouteParams = {}) => {
    if (!enabled) return;
    const next = pushPage(ref.current, { id: p, root: currentRoot, params });
    if (next === ref.current) return;
    commit(next);
    if (typeof window !== "undefined") {
      window.history.pushState({ page: p }, "", hashForRoute(currentRoot, topPage(next)));
    }
  }, [commit, enabled, currentRoot]);

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
    else window.history.replaceState({}, "", hashForRoute(currentRoot, topPage(next)));
  }, [commit, enabled, currentRoot]);

  // With the flag off there is no page to sync, so don't subscribe at all.
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      const next = nextStackForPopstate(ref.current, window.location.hash, currentRoot);
      ref.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled, currentRoot]);

  /** Drop every page and return to `nextRoot` (default: the current root). A no-op when nothing is
   *  open (so it is safe on a tab change), and it rewrites the hash whenever a page WAS open, so a
   *  stale deep link cannot leave the URL naming a page the player has closed. */
  const clear = useCallback((nextRoot?: RootId) => {
    if (ref.current.length === 0) return;
    ref.current = [];
    setStack([]);
    if (typeof window !== "undefined") window.history.replaceState({}, "", hashForRoute(nextRoot ?? currentRoot, null));
  }, [currentRoot]);

  const top = enabled ? topPage(stack) : null;
  return { root: top?.root ?? currentRoot, page: top?.id ?? null, params: top?.params ?? {}, push, pop, clear };
}
