// Staff life-event interrupt (item 2.2) — a named teammate hits a personal turning point (burnout,
// an outside offer, a milestone) and the player answers with a small, human choice. Reuses the
// growth-moment card styling (liquid glass). Lowest-priority interrupt: yields to the launch reveal
// and every other pending card, so it never buries a more important moment.
import { useEffect, useRef, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending, decisionPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { FirstTimeNote } from "./FirstTimeNote.tsx";
import "./staffMoment.css";

export function StaffEvent() {
  const { state, resolveStaffEvent } = useGame();
  const ev = state.pendingStaffEvent ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lowest priority: yield to the player's launch payoff and every other interrupt card.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "staffEvent") || decisionPending(state);
  const showing = ev !== null && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("confirm");
    haptic.light?.();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing || !ev) return null;

  return (
    <div className="stfm">
      <div className="stfm__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="stfm__card" role="dialog" aria-modal="true" aria-label="A teammate needs a decision">
        <div className="stfm__glyph" aria-hidden><HeartHandshake size={28} /></div>
        <div className="stfm__eyebrow">Your team</div>
        <h2 className="stfm__title">{ev.title}</h2>
        <p className="stfm__sub">{ev.body}</p>
        <FirstTimeNote intro="staffEvent" />
        <div className="stfm__choices">
          {ev.options.map((opt, i) => (
            <button key={i} className="stfm__choice" onClick={() => resolveStaffEvent(i)}>
              <span className="stfm__choice-glyph" aria-hidden>{i + 1}</span>
              <span className="stfm__choice-text">
                <span className="stfm__choice-name">{opt.label}</span>
                <span className="stfm__choice-note">{opt.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
