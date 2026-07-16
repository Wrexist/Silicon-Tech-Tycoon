// Quarterly earnings interrupt (post-IPO) — the street judged the quarter. A BEAT pops the share
// price and you take a bow; a MISS sinks it and you decide whether to defend the price with a buyback
// or ride it out. This is the late-game accountability loop: once public, you can't just coast. Mounted
// once in App; same pause/overlay/serialize contract as the other interrupts (lowest priority but for
// the ready build / launch reveal).
import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { companyValuation } from "../state/gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { format, scale } from "../engine/money.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./earningsCall.css";

export function EarningsCall() {
  const { state, resolveEarnings } = useGame();
  const report = state.pendingEarnings ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "earnings");
  const showing = report !== null && !higherUp;

  // Hold the sim while the call is up; cue once when it appears (re-armed when it hides).
  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx(report?.beat ? "cash" : "error");
    haptic.medium?.();
  }, [showing, report?.beat]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing || !report) return null;
  const beat = report.beat;
  const move = Math.round(Math.abs(report.priceMovePct) * 100);
  const defendCost = scale(companyValuation(state), BALANCE.ipo.shareholders.defendBuybackPct);
  const canDefend = state.cash >= defendCost;
  return (
    <div className="ern">
      <div className="ern__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className={`ern__card ern__card--${beat ? "beat" : "miss"}`} role="dialog" aria-modal="true" aria-label="Quarterly earnings">
        <div className={`ern__glyph ern__glyph--${beat ? "beat" : "miss"}`} aria-hidden>{beat ? <TrendingUp size={26} /> : <TrendingDown size={26} />}</div>
        <div className={`ern__eyebrow ern__eyebrow--${beat ? "beat" : "miss"}`}>Q{report.quarter} earnings call</div>
        <h2 className="ern__title">{beat ? "You beat the street" : "You missed the street"}</h2>
        <p className="ern__sub">
          {beat
            ? `Revenue came in ahead of expectations — the shares popped ${move}%.`
            : `Revenue came in light — the shares slid ${move}%.`}
        </p>
        <div className="ern__terms">
          <div className="ern__term">
            <span className="ern__term-label">This quarter</span>
            <span className="ern__term-val tnum">{format(report.revenue)}</span>
          </div>
          <div className="ern__term">
            <span className="ern__term-label">The street wanted</span>
            <span className="ern__term-val tnum">{format(report.expectation)}</span>
          </div>
          <div className="ern__term">
            <span className="ern__term-label">Share price</span>
            <span className={`ern__term-val tnum ${beat ? "ern__term-val--pos" : "ern__term-val--neg"}`}>{beat ? "+" : "−"}{move}%</span>
          </div>
        </div>
        {beat ? (
          <Button block haptics="none" onClick={() => resolveEarnings(false)}>Great quarter</Button>
        ) : (
          <div className="ern__actions">
            <Button block disabled={!canDefend} haptics="none" onClick={() => resolveEarnings(true)}>
              <ShieldCheck size={16} /> {canDefend ? `Steady the price · ${format(defendCost)}` : "Can't afford a buyback"}
            </Button>
            <Button block variant="tertiary" haptics="none" onClick={() => resolveEarnings(false)}>Ride it out</Button>
          </div>
        )}
      </div>
    </div>
  );
}
