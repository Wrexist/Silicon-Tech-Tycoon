// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useRef, useState } from "react";
import { hashForPage, pageFromHash, popPage, pushPage, topPage, type PageId, type PageStack } from "./pageStack.ts";

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

export function usePageNav(): { page: PageId | null; push: (p: PageId) => void; pop: () => void } {
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
    const next = pushPage(ref.current, p);
    if (next === ref.current) return;
    commit(next);
    if (typeof window !== "undefined") window.history.pushState({ page: p }, "", hashForPage(p));
  }, [commit]);

  const pop = useCallback(() => {
    const current = ref.current;
    if (current.length === 0) return;
    const next = popPage(current);
    commit(next);
    if (typeof window === "undefined") return;
    // Back is only correct when this entry is one WE pushed (it carries our state). A deep-linked
    // page is the FIRST history entry, where history.back() would leave the site.
    if (window.history.state?.page) window.history.back();
    else window.history.replaceState({}, "", hashForPage(topPage(next)));
  }, [commit]);

  useEffect(() => {
    const onPop = () => {
      const next = nextStackForPopstate(ref.current, window.location.hash);
      ref.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { page: topPage(stack), push, pop };
}
