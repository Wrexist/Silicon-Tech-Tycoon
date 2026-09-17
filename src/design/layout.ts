// Layout modes for the responsive shell. These breakpoints are the single source of truth: the CSS
// media queries are written to match these numbers. The resolver is pure so the thresholds are
// testable without a DOM.
import { useEffect, useState } from "react";

export const LAYOUT_BREAKPOINTS = { tablet: 700, wide: 1100 } as const;

export type LayoutMode = "phone" | "tablet" | "wide";

/** Pure: width -> mode. The boundary belongs to the wider mode. A non-finite width is phone, the
 *  conservative answer, so a bad measurement can never force the desktop chrome onto a phone. */
export function layoutModeForWidth(width: number): LayoutMode {
  if (!Number.isFinite(width) || width < LAYOUT_BREAKPOINTS.tablet) return "phone";
  if (width >= LAYOUT_BREAKPOINTS.wide) return "wide";
  return "tablet";
}

/** The side rail replaces the bottom tab bar on tablet and wide. */
export function railShown(mode: LayoutMode): boolean {
  return mode !== "phone";
}

/** Live layout mode. Both queries only fire on a boundary crossing, so this is cheap. */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() =>
    layoutModeForWidth(typeof window === "undefined" ? 0 : window.innerWidth),
  );
  useEffect(() => {
    const update = () => setMode(layoutModeForWidth(window.innerWidth));
    update();
    const tablet = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.tablet}px)`);
    const wide = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`);
    tablet.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);
  return mode;
}
