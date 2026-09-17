// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useState } from "react";
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

  const push = useCallback((p: PageId) => {
    setStack((s) => {
      const next = pushPage(s, p);
      if (next !== s && typeof window !== "undefined") {
        window.history.pushState({ page: p }, "", hashForPage(p));
      }
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) return s;
      const next = popPage(s);
      if (typeof window !== "undefined") {
        // Back is only correct when this entry is one WE pushed (it carries our state). A page opened
        // by deep-link is the FIRST history entry, where history.back() would leave the site — so in
        // that case rewrite the hash to the parent instead.
        if (window.history.state?.page) window.history.back();
        else window.history.replaceState({}, "", hashForPage(topPage(next)));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => setStack((s) => nextStackForPopstate(s, window.location.hash));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { page: topPage(stack), push, pop };
}
