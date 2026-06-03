import { useEffect, useRef, useState } from "react";
import { format, type Money } from "../engine/money.ts";

/** Reactive read of the user's reduced-motion preference. When true, count-up tweens snap to the
 *  final value instead of animating (WCAG 2.3.3 / respects the OS "Reduce Motion" setting). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Count-up tween between values; brief color flash up(green)/down(red). Snaps when reduced-motion. */
export function AnimatedMoney({
  value,
  className = "",
  sign = false,
}: {
  value: Money;
  className?: string;
  sign?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    // Reduced motion: snap to the final value, no tween (a single brief colour flash is fine).
    if (reduced) {
      setFlash(to > from ? "up" : "down");
      setDisplay(to);
      fromRef.current = to;
      const id = setTimeout(() => setFlash(null), 320);
      return () => clearTimeout(id);
    }
    setFlash(to > from ? "up" : "down");
    const start = performance.now();
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(((from + (to - from) * eased) | 0) as Money);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(to);
        fromRef.current = to;
        setTimeout(() => setFlash(null), 320);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, reduced]);

  const color = flash === "up" ? "var(--positive)" : flash === "down" ? "var(--negative)" : undefined;
  return (
    <span
      className={`tnum ${className}`}
      style={{ color, transition: "color 320ms" }}
    >
      {format(display, { sign })}
    </span>
  );
}

/** Plain integer count-up (no currency). */
export function AnimatedInt({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    // Reduced motion: snap straight to the value, no count-up tween.
    if (reduced) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, reduced]);
  return <span className={`tnum ${className}`}>{display.toLocaleString()}</span>;
}
