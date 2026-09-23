import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Reserve the actual chrome height, including text scaling and device safe areas. */
export function BottomDock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => document.documentElement.style.setProperty("--dock-height", `${node.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--dock-height"); };
  }, []);
  return <div className="app__dock" ref={ref}>{children}</div>;
}
