// Community ask interrupt — once you have a fanbase, the community periodically asks for something
// (an AMA, a public beta, a merch drop, a meetup). This turns the passive mood meter into a system
// with AGENCY: ANSWER the call (spend cash → grow + delight the base) or PASS (a small mood dip).
// Decision → a brief "answered" reveal. Mounted once in App; same pause/overlay/serialize contract as
// the eureka + rival-strike interrupts (it yields to the launch reveal, strikes, awards, rivalry, and
// eureka, and any unclaimed ready build — it's the lowest-priority interrupt).
import { useEffect, useRef, useState } from "react";
import { Heart, MessagesSquare, FlaskConical, Shirt, Users, BadgeDollarSign, Sparkles, type LucideIcon } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { ASK_INFO } from "../engine/community.ts";
import type { CommunityAskResult } from "../state/gameState.ts";
import { format } from "../engine/money.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./communityAsk.css";

// The engine ships an icon KEY (it stays DOM-free); map it to a Lucide glyph here.
const ICONS: Record<string, LucideIcon> = { MessagesSquare, FlaskConical, Shirt, Users };

export function CommunityAsk() {
  const { state, resolveCommunityAsk } = useGame();
  const ask = state.pendingCommunityAsk ?? null;
  const [answered, setAnswered] = useState<CommunityAskResult | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Serialize below the player's own payoff (launch reveal) and every other interrupt.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "communityAsk");
  // The reveal must survive `ask` clearing the instant we answer, so `answered` holds the card up.
  const showing = (ask !== null || answered !== null) && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("toggle");
    haptic.medium?.();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing) return null;

  // ---- Answered reveal ----
  if (answered) {
    return (
      <div className="cma">
        <div className="cma__scrim" aria-hidden />
        <div ref={dialogRef} tabIndex={-1} className="cma__card cma__card--done" role="dialog" aria-modal="true" aria-label="Community delighted">
          <div className="cma__glyph cma__glyph--done" aria-hidden><Sparkles size={26} /></div>
          <div className="cma__eyebrow cma__eyebrow--done">The community loves it</div>
          <h2 className="cma__title">Fans are delighted</h2>
          <p className="cma__sub">You showed up for them, and it shows.</p>
          <div className="cma__chips">
            <div className="cma__chip">
              <span className="cma__chip-icon" aria-hidden><Users size={14} /></span>
              <strong>+{(answered.fanGain ?? 0).toLocaleString()}</strong>
              <small>new fans</small>
            </div>
            <div className="cma__chip">
              <span className="cma__chip-icon" aria-hidden><Heart size={14} /></span>
              <strong>Warmer</strong>
              <small>community mood</small>
            </div>
          </div>
          <Button block haptics="none" onClick={() => setAnswered(null)}>Continue</Button>
        </div>
      </div>
    );
  }

  // ---- Decision ----
  if (!ask) return null;
  const info = ASK_INFO[ask.kind];
  const Icon = ICONS[info.icon] ?? Heart;
  const canAfford = state.cash >= ask.cost;
  return (
    <div className="cma">
      <div className="cma__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="cma__card" role="dialog" aria-modal="true" aria-label="The community is asking">
        <div className="cma__glyph" aria-hidden><Icon size={26} /></div>
        <div className="cma__eyebrow">The community is asking</div>
        <h2 className="cma__title">{info.title}</h2>
        <p className="cma__sub">{info.blurb}</p>
        <div className="cma__terms">
          <div className="cma__term">
            <span className="cma__term-label"><BadgeDollarSign size={13} aria-hidden /> Cost</span>
            <span className={`cma__term-val tnum${canAfford ? "" : " cma__term-val--short"}`}>{format(ask.cost)}</span>
          </div>
          <div className="cma__term">
            <span className="cma__term-label"><Users size={13} aria-hidden /> Grows the base</span>
            <span className="cma__term-val cma__term-val--pos tnum">+{ask.fanGain.toLocaleString()} fans</span>
          </div>
        </div>
        <div className="cma__actions">
          <Button
            block
            disabled={!canAfford}
            haptics="none"
            onClick={() => { const r = resolveCommunityAsk(true); if (r.ok && r.answered) setAnswered(r); }}
          >
            <Heart size={16} /> {canAfford ? info.answer : "Can't afford it"}
          </Button>
          <Button
            block
            variant="tertiary"
            haptics="none"
            onClick={() => { resolveCommunityAsk(false); }}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
