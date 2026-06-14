// Celebratory confetti burst for the core-loop payoff (a hit launch). Zero assets — small
// parametric pieces in three on-palette hues, kept restrained (count/duration) so it reads
// premium, not garish. Subscribes to the celebrate bus; suppressed under reduced motion.
import { useEffect, useRef, useState } from "react";
import { onCelebrate } from "./celebrateFx.ts";
import "./confetti.css";

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Piece {
  x: number; // vw start
  hue: string;
  delay: number; // ms
  dur: number; // ms
  rot: number; // deg
  drift: number; // px horizontal
}
interface Burst {
  id: number;
  pieces: Piece[];
}

const HUES = ["var(--accent)", "var(--positive)", "var(--warning)"];
const COUNT = 26;
let seq = 0;

function makeBurst(): Burst {
  const pieces: Piece[] = Array.from({ length: COUNT }, () => ({
    x: 8 + Math.random() * 84,
    hue: HUES[(Math.random() * HUES.length) | 0],
    delay: Math.random() * 140,
    dur: 1100 + Math.random() * 700,
    rot: Math.random() * 720 - 360,
    drift: Math.random() * 90 - 45,
  }));
  return { id: seq++, pieces };
}

export function Confetti() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(
    () =>
      onCelebrate(() => {
        if (reducedMotion()) return;
        const burst = makeBurst();
        setBursts((b) => [...b.slice(-2), burst]);
        timers.current.push(
          setTimeout(() => setBursts((b) => b.filter((x) => x.id !== burst.id)), 2200),
        );
      }),
    [],
  );

  if (bursts.length === 0) return null;
  return (
    <div className="confetti" aria-hidden>
      {bursts.map((burst) =>
        burst.pieces.map((p, i) => (
          <span
            key={`${burst.id}-${i}`}
            className="confetti__piece"
            style={{
              left: `${p.x}vw`,
              background: p.hue,
              "--cf-dur": `${p.dur}ms`,
              "--cf-delay": `${p.delay}ms`,
              "--cf-rot": `${p.rot}deg`,
              "--cf-drift": `${p.drift}px`,
            } as React.CSSProperties}
          />
        )),
      )}
    </div>
  );
}
