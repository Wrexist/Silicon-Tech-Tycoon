import { useEffect, useState } from "react";
// Capability checks for the 3D HQ — decide whether to render WebGL or fall back to SVG.
let webgl: boolean | null = null;

export function webglSupported(): boolean {
  if (webgl !== null) return webgl;
  try {
    // three r163+ requires WebGL2 — probing WebGL1 here let WebGL1-only devices pass the gate
    // and then crash into the ErrorBoundary instead of cleanly falling back to the SVG scene.
    const c = document.createElement("canvas");
    webgl = !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch {
    webgl = false;
  }
  return webgl;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function isDarkTheme(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

/** `prefersReducedMotion()` as a LIVE hook — re-renders when the OS preference changes, so toggling
 *  Reduce Motion in Settings swaps the office (and the Settings row that explains it) immediately
 *  rather than on the next cold start. Lives here beside the capability checks so HQ and Settings
 *  read one implementation; they used to be the same ten lines written out twice. */
export function useReducedMotionLive(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq?.addEventListener) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
