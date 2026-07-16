// Post-launch reactive-event interrupt (item 3.6) — a product already on shelves hits a mid-lifecycle
// moment (flying off shelves / stalling / a supply pinch) and the player answers with a small business
// choice. Reuses the growth-moment card styling (liquid glass). Lowest-priority interrupt: yields to
// the launch reveal and every other pending card, so it never buries a more important moment.
import { useEffect, useRef, useState } from "react";
import { LineChart, TrendingDown, PackageX } from "lucide-react";
import { useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending, decisionPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./staffMoment.css";

const GLYPH = { momentum: LineChart, stall: TrendingDown, supply: PackageX } as const;

export function PostLaunchEvent() {
  const { state, resolvePostLaunch } = useGame();
  const ev = state.pendingPostLaunch ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lowest priority: yield to the player's launch payoff and every other interrupt card.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "postLaunch") || decisionPending(state);
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
  const Glyph = GLYPH[ev.kind];

  return (
    <div className="stfm">
      <div className="stfm__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="stfm__card" role="dialog" aria-modal="true" aria-label="A product on shelves needs a decision">
        <div className="stfm__glyph" aria-hidden><Glyph size={28} /></div>
        <div className="stfm__eyebrow">On shelves</div>
        <h2 className="stfm__title">{ev.title}</h2>
        <p className="stfm__sub">{ev.body}</p>
        <div className="stfm__choices">
          {ev.options.map((opt, i) => (
            <button key={i} className="stfm__choice" onClick={() => resolvePostLaunch(i)}>
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
