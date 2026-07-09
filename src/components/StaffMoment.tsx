// Staff growth moment interrupt — a tenured, senior teammate has grown, and the player CHOOSES how to
// develop them: a second design specialty, a second (stacking) trait, or becoming a team mentor. The
// choice is permanent. Decision → a short celebratory reveal. Mounted once in App; lowest-priority of
// the opportunistic interrupts, so it yields to the launch reveal and every other pending card.
import { useEffect, useRef, useState } from "react";
import { Award, Gem, GraduationCap, Sparkles } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { ROLE_TITLE } from "../engine/staff.ts";
import type { StaffGrowthKind, StaffGrowthOption } from "../engine/staffMoment.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./staffMoment.css";

const KIND_ICON: Record<StaffGrowthKind, typeof Gem> = {
  specialty: Gem,
  trait: Sparkles,
  mentor: GraduationCap,
};

export function StaffMoment() {
  const { state, resolveStaffMoment } = useGame();
  const moment = state.pendingStaffMoment ?? null;
  const [chosen, setChosen] = useState<StaffGrowthOption | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lowest priority: yield to the player's own launch payoff and every other interrupt card.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp =
    revealUp ||
    state.pendingStrike != null || state.pendingAwards != null || state.pendingRivalry != null ||
    state.pendingEureka != null || state.pendingCommunityAsk != null || state.pendingEarnings != null ||
    state.ready.some((p) => !readyLaunchClaimed(p.id));
  // The reveal must survive `moment` clearing the instant we choose, so `chosen` holds the card up.
  const showing = (moment !== null || chosen !== null) && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("levelup");
    haptic.medium?.();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing) return null;

  // ---- Outcome reveal ----
  if (chosen) {
    return (
      <div className="stfm">
        <div className="stfm__scrim" aria-hidden />
        <div ref={dialogRef} tabIndex={-1} className="stfm__card stfm__card--result" role="dialog" aria-modal="true" aria-label="Growth applied">
          <div className="stfm__glyph stfm__glyph--result" aria-hidden><Sparkles size={28} /></div>
          <div className="stfm__eyebrow">Leveled up</div>
          <h2 className="stfm__title">{chosen.label}</h2>
          <p className="stfm__sub">{chosen.blurb}</p>
          <Button block haptics="none" onClick={() => setChosen(null)}>Continue</Button>
        </div>
      </div>
    );
  }

  // ---- Decision ----
  if (!moment) return null;
  return (
    <div className="stfm">
      <div className="stfm__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="stfm__card" role="dialog" aria-modal="true" aria-label="A teammate has grown">
        <div className="stfm__glyph" aria-hidden><Award size={28} /></div>
        <div className="stfm__eyebrow">Growth moment</div>
        <h2 className="stfm__title">{moment.staffName} has grown</h2>
        <p className="stfm__sub">
          {moment.staffName} has become one of your best — a skill&nbsp;{moment.skill} {ROLE_TITLE[moment.role]}. Choose how they develop. It&apos;s permanent.
        </p>
        <div className="stfm__choices">
          {moment.options.map((opt, i) => {
            const Icon = KIND_ICON[opt.kind];
            return (
              <button key={opt.kind} className="stfm__choice" onClick={() => { const r = resolveStaffMoment(i); if (r.ok) setChosen(opt); }}>
                <span className="stfm__choice-glyph" aria-hidden><Icon size={18} /></span>
                <span className="stfm__choice-text">
                  <span className="stfm__choice-name">{opt.label}</span>
                  <span className="stfm__choice-note">{opt.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
