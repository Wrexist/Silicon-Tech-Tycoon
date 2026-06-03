// Floating gain feedback — spawns rising "+$X" / "+N RP" tokens when cash or research
// points increase on a tick. Subtle, premium, auto-removing.
import { useEffect, useRef, useState } from "react";
import { format, type Money } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import "./gainFX.css";

// Live read of reduced-motion. The floating "+$X" tokens are a purely decorative rising/fading
// animation, so when the user prefers reduced motion we suppress them entirely (WCAG 2.3.3).
function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Token {
  id: number;
  text: string;
  kind: "cash" | "rp";
}

let seq = 0;

export function GainFX() {
  const { state } = useGame();
  const [tokens, setTokens] = useState<Token[]>([]);
  const prevCash = useRef(state.cash);
  const prevRp = useRef(state.researchPoints);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spawn = (text: string, kind: Token["kind"]) => {
    if (reducedMotion()) return; // suppress the floating gain animation under reduced motion
    const id = seq++;
    setTokens((t) => [...t.slice(-5), { id, text, kind }]);
    timers.current.push(setTimeout(() => setTokens((t) => t.filter((x) => x.id !== id)), 1500));
  };

  useEffect(() => {
    const dCash = (state.cash - prevCash.current) as Money;
    prevCash.current = state.cash;
    if (dCash > 0) spawn(`+${format(dCash)}`, "cash");
  }, [state.cash]);

  useEffect(() => {
    const dRp = state.researchPoints - prevRp.current;
    prevRp.current = state.researchPoints;
    if (dRp >= 1) spawn(`+${Math.round(dRp)} RP`, "rp");
  }, [state.researchPoints]);

  if (tokens.length === 0) return null;
  return (
    <div className="gainfx" aria-hidden>
      {tokens.map((t) => (
        <span key={t.id} className={`gainfx__tok gainfx__tok--${t.kind} tnum`}>
          {t.text}
        </span>
      ))}
    </div>
  );
}
