// Layout modes for the responsive shell. These breakpoints are the single source of truth: the CSS
// media queries are written to match these numbers. The resolver is pure so the thresholds are
// testable without a DOM.
import { useEffect, useState } from "react";

// The side rail is 208px and the content column is 540px, so below ~800px of viewport the two
// cannot coexist without the rail covering content; 800 is also ≈ iPad portrait (820), the first
// real device that fits both.
export const LAYOUT_BREAKPOINTS = { tablet: 800, wide: 1100 } as const;

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

/** Derive the mode from the SAME queries the CSS uses, so JS and the stylesheet can never
 *  disagree (innerWidth includes the desktop scrollbar; a media query does not). */
function modeFromQueries(tablet: MediaQueryList, wide: MediaQueryList): LayoutMode {
  if (wide.matches) return "wide";
  if (tablet.matches) return "tablet";
  return "phone";
}

/** Live layout mode. Both queries only fire on a boundary crossing, so this is cheap. */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "phone";
    return modeFromQueries(
      window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.tablet}px)`),
      window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`),
    );
  });
  useEffect(() => {
    const tablet = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.tablet}px)`);
    const wide = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`);
    const update = () => setMode(modeFromQueries(tablet, wide));
    update();
    tablet.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);
  return mode;
}
