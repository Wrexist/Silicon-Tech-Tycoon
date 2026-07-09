// The "Rivalry declared" moment — the week one rival becomes your ARCH-RIVAL. A full-screen reveal
// (no decision, just a beat) introducing the villain + their doctrine, dismissed on "Bring it on".
// Mounted once in App; same pause/overlay/serialize contract as the Awards ceremony (it yields to the
// launch reveal, a pending strike, and any unclaimed ready build so only one modal owns the screen).
import { useEffect, useRef, useState } from "react";
import { Swords, Flame } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { DOCTRINE_LABEL } from "../engine/competitors.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./rivalryDeclared.css";

// A one-line "who they are" flavour per doctrine — sets the tone for the feud ahead.
const DOCTRINE_TAGLINE: Record<string, string> = {
  defender: "They built an empire and they'll defend it — now from you.",
  trendChaser: "They chase every trend. Ship a hit and they'll crowd it.",
  undercutter: "They win on price. Expect your margins under siege.",
  generalist: "Broad, relentless, everywhere. No category is safe.",
};

export function RivalryDeclared() {
  const { state, dismissRivalry } = useGame();
  const rivalry = state.pendingRivalry ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Serialize with the other interrupts — yield the stage to a launch reveal, a pending strike, and any
  // unclaimed ready build, so only one modal pauses + owns Escape at a time.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || state.pendingStrike != null || state.pendingAwards != null || state.ready.some((p) => !readyLaunchClaimed(p.id));
  const showing = rivalry !== null && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("hit");
    haptic.heavy();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);

  useDialogFocus(dialogRef, showing);
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissRivalry(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showing, dismissRivalry]);

  if (!rivalry || !showing) return null;

  return (
    <div className="rvd">
      <div className="rvd__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="rvd__card" role="dialog" aria-modal="true" aria-label={`${rivalry.rivalName} is now your arch-rival`}>
        <div className="rvd__glyph" aria-hidden>
          <Swords size={30} />
          <span className="rvd__glyph-spark" aria-hidden><Flame size={16} /></span>
        </div>
        <div className="rvd__eyebrow">Rivalry declared</div>
        <h2 className="rvd__title">{rivalry.rivalName}</h2>
        <p className="rvd__vs">is now your arch-rival</p>
        <p className="rvd__tagline">{DOCTRINE_TAGLINE[rivalry.doctrine] ?? DOCTRINE_TAGLINE.generalist}</p>
        <div className="rvd__doctrine">{DOCTRINE_LABEL[rivalry.doctrine as keyof typeof DOCTRINE_LABEL] ?? "Competitor"}</div>
        <p className="rvd__note">Every time you clash — you overtake them, they strike you, you meet on the awards stage — the rivalry heats up. Beat them for good, or watch them come for your turf.</p>
        <Button block haptics="none" onClick={dismissRivalry}>Bring it on</Button>
      </div>
    </div>
  );
}
