import { useEffect, useRef, useState } from "react";
import { format, type Money } from "../engine/money.ts";

/** Count-up tween between values; brief color flash up(green)/down(red). Never snaps. */
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

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
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
  }, [value]);

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
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
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
  }, [value]);
  return <span className={`tnum ${className}`}>{display.toLocaleString()}</span>;
}
