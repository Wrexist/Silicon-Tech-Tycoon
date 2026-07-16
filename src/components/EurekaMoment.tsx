// Eureka breakthrough interrupt — an active, funded lab had a flash of insight. This turns the flat
// RP trickle into a MOMENT with a real bet: BANK a guaranteed windfall, or CHASE the prototype (a
// jackpot-or-fizzle gamble). Decision → staged outcome reveal. Mounted once in App; same pause/overlay/
// serialize contract as the rival strike (it yields to the launch reveal, strikes, awards, rivalry
// reveal, and any unclaimed ready build).
import { useEffect, useRef, useState } from "react";
import { Lightbulb, Landmark, FlaskConical, Sparkles, Cpu } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import type { EurekaResult } from "../state/gameState.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { FirstTimeNote } from "./FirstTimeNote.tsx";
import "./eurekaMoment.css";

export function EurekaMoment() {
  const { state, resolveEureka } = useGame();
  const moment = state.pendingEureka ?? null;
  const [outcome, setOutcome] = useState<EurekaResult | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Serialize below the player's own payoff (launch reveal) and the other interrupts.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "eureka");
  // Keep the stage while resolving: `moment` clears the instant we bank/chase, but the outcome reveal
  // must survive that, so `outcome` holds the card up until Continue.
  const showing = (moment !== null || outcome !== null) && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("rp");
    haptic.medium?.();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing) return null;

  // ---- Outcome reveal ----
  if (outcome) {
    const jackpot = !!outcome.jackpot;
    return (
      <div className="eur">
        <div className="eur__scrim" aria-hidden />
        <div ref={dialogRef} tabIndex={-1} className={`eur__card eur__card--result${jackpot ? " eur__card--jackpot" : ""}`} role="dialog" aria-modal="true" aria-label="Breakthrough result">
          <div className={`eur__glyph${jackpot ? " eur__glyph--jackpot" : ""}`} aria-hidden>{jackpot ? <Sparkles size={28} /> : <FlaskConical size={26} />}</div>
          <div className="eur__eyebrow">{jackpot ? "Prototype landed" : "Insight banked"}</div>
          <h2 className="eur__title">+{outcome.rp} RP</h2>
          <p className="eur__sub">{jackpot ? "The prototype worked — a genuine breakthrough, and word gets out." : "Added to the lab's research pool."}</p>
          <Button block haptics="none" onClick={() => setOutcome(null)}>Continue</Button>
        </div>
      </div>
    );
  }

  // ---- Decision ----
  if (!moment) return null;
  const chasePct = Math.round(moment.jackpotChance * 100);
  return (
    <div className="eur">
      <div className="eur__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="eur__card" role="dialog" aria-modal="true" aria-label="A eureka breakthrough">
        <div className="eur__glyph" aria-hidden><Lightbulb size={28} /></div>
        <div className="eur__eyebrow">Eureka</div>
        <h2 className="eur__title">A breakthrough</h2>
        <p className="eur__sub">
          Your researchers stumbled onto something in the <span className="eur__kind"><Cpu size={12} aria-hidden /> {moment.componentKind}</span> line. Cash it in, or push for a prototype?
        </p>
        <FirstTimeNote intro="eureka" />
        <div className="eur__choices">
          <button className="eur__choice" onClick={() => { const r = resolveEureka("bank"); if (r.ok) setOutcome(r); }}>
            <span className="eur__choice-glyph" aria-hidden><Landmark size={18} /></span>
            <span className="eur__choice-name">Bank it</span>
            <span className="eur__choice-val tnum">+{moment.bankRp} RP</span>
            <span className="eur__choice-note">Guaranteed</span>
          </button>
          <button className="eur__choice eur__choice--risk" onClick={() => { const r = resolveEureka("chase"); if (r.ok) setOutcome(r); }}>
            <span className="eur__choice-glyph" aria-hidden><FlaskConical size={18} /></span>
            <span className="eur__choice-name">Chase it</span>
            <span className="eur__choice-val tnum">+{moment.jackpotRp} <span className="eur__choice-or">or</span> +{moment.fizzleRp} RP</span>
            <span className="eur__choice-note">{chasePct}% it lands</span>
          </button>
        </div>
      </div>
    </div>
  );
}
