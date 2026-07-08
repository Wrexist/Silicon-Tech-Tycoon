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
  // Real-time throttle for PASSIVE gain tokens only: weekly income rises every tick, so without this
  // a normal run (and especially fast-forward) spews a "+$X"/"+N RP" token every single week. One
  // token per ~fade-window reads as "occasional feedback" instead of a stream. Spends are user-driven
  // and one-per-action, so they stay immediate (they never route through here).
  const lastPassiveGain = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spawn = (text: string, kind: Token["kind"]) => {
    if (reducedMotion()) return;
    const id = seq++;
    setTokens((t) => [...t.slice(-6), { id, text, kind }]);
    const tid = setTimeout(() => {
      setTokens((t) => t.filter((x) => x.id !== id));
      timers.current = timers.current.filter((x) => x !== tid);
    }, 1500);
    timers.current.push(tid);
  };

  // Passive gains (tick income): show at most one token per fade window so a fast run doesn't stream.
  const spawnPassive = (text: string, kind: Token["kind"]) => {
    const now = Date.now();
    if (now - lastPassiveGain.current < 1400) return;
    lastPassiveGain.current = now;
    spawn(text, kind);
  };

  // Gain tokens from state diffs (tick-based income)
  useEffect(() => {
    const dCash = (state.cash - prevCash.current) as Money;
    prevCash.current = state.cash;
    if (dCash > 0) spawnPassive(`+${format(dCash)}`, "cash");
  }, [state.cash]);

  useEffect(() => {
    const dRp = state.researchPoints - prevRp.current;
    prevRp.current = state.researchPoints;
    if (dRp >= 1) spawnPassive(`+${Math.round(dRp)} RP`, "rp");
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
