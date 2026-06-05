// Floating gain/spend feedback — spawns rising "+$X" / "+N RP" / "-$X" / "-N RP" tokens
// on cash/RP changes. Gains come from state diffs; spends come from the module-level
// emitter in spendFx.ts (fired by explicit user purchase callbacks in useGame.tsx).
import { useEffect, useRef, useState } from "react";
import { format, type Money } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import { onSpend, onRpSpend } from "./spendFx.ts";
import "./gainFX.css";

// Live read of reduced-motion. The floating tokens are purely decorative rising/fading
// animations, so when the user prefers reduced motion we suppress them entirely (WCAG 2.3.3).
function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Token {
  id: number;
  text: string;
  kind: "cash" | "rp" | "spend" | "rp-spend";
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
    if (reducedMotion()) return;
    const id = seq++;
    setTokens((t) => [...t.slice(-6), { id, text, kind }]);
    timers.current.push(setTimeout(() => setTokens((t) => t.filter((x) => x.id !== id)), 1500));
  };

  // Gain tokens from state diffs (tick-based income)
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

  // Spend tokens from explicit user purchases (fired via emitSpend / emitRpSpend)
  useEffect(() => {
    const unsub = onSpend((amount) => spawn(`-${format(amount)}`, "spend"));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onRpSpend((rp) => spawn(`-${Math.round(rp)} RP`, "rp-spend"));
    return unsub;
  }, []);

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
