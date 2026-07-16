// Decision Inbox banner — the calm home for low-stakes interrupts. Instead of a staff / community /
// regional / post-launch card seizing the whole screen the moment it's raised, this shows a quiet,
// non-blocking banner that a decision is waiting; tapping "Review" opens the matching overlay on the
// player's schedule. Mounted once in App. Presentation only — the engine is unchanged.
import { useEffect } from "react";
import { Inbox, ChevronRight } from "lucide-react";
import { useGame } from "../state/useGame.tsx";
import { inboxPendingKey, higherPriorityPending, INBOX_LABEL } from "../design/interruptPriority.ts";
import { useDecisionOpen, openDecision, closeDecision } from "../design/decisionInbox.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./decisionInbox.css";

export function DecisionInbox() {
  const { state } = useGame();
  const open = useDecisionOpen();
  const key = inboxPendingKey(state);

  // Once the waiting decision resolves (its pending clears), reset so the NEXT one shows as a banner
  // instead of auto-opening. This also guarantees the flag never sticks "open" with nothing pending.
  useEffect(() => {
    if (!key) closeDecision();
  }, [key]);

  // Nothing waiting, or the player already opened it (the overlay is showing) → no banner.
  if (!key || open) return null;
  // Yield to a launch payoff or any weightier takeover that's on screen.
  if (higherPriorityPending(state, key)) return null;

  const label = INBOX_LABEL[key];
  if (!label) return null;

  return (
    <div className="dinbox" role="status" aria-live="polite">
      <button
        type="button"
        className="dinbox__card"
        onClick={() => { haptic.light(); sfx("tap"); openDecision(); }}
        aria-label={`Review: ${label.title}`}
      >
        <span className="dinbox__glyph" aria-hidden><Inbox size={18} /></span>
        <span className="dinbox__text">
          <span className="dinbox__eyebrow">{label.eyebrow} · Decision waiting</span>
          <span className="dinbox__title">{label.title}</span>
        </span>
        <span className="dinbox__cta">Review <ChevronRight size={16} aria-hidden /></span>
      </button>
    </div>
  );
}
