// "Enjoying Silicon?" — a review moment that lands shortly after a real high point: the FIRST
// device shipped, the first hit, or a new era (state/review.ts decides when, at most once each). It's a soft pre-ask, not the App Store prompt itself: tapping
// "Rate" hands off to StoreKit's native review request (requestAppStoreReview), so the OS's limited
// prompts are spent only on players who are actually happy — and "Maybe later" simply closes it.
// Same liquid-glass contract as the other interrupts (clear scrim, the card is the glass, edge rim);
// holds the sim while up (useHoldSim) and yields to a launch reveal that's still playing.
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useHoldSim } from "../state/useGame.tsx";
import { useEscapeLayer } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { markReviewRated, onReviewPrompt, requestAppStoreReview, type ReviewMoment } from "../state/review.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./reviewPrompt.css";

const STARS = [0, 1, 2, 3, 4];

const COPY: Record<ReviewMoment, { eyebrow: string; sub: string }> = {
  "first-launch": { eyebrow: "First device shipped", sub: "You just shipped your first product — a real milestone. If the game's been fun, a quick rating helps other founders discover it. It only takes a second." },
  "first-hit": { eyebrow: "That's a hit", sub: "The market loved it. If you're loving Silicon too, a quick rating helps other founders find the game. It only takes a second." },
  "new-era": { eyebrow: "A new era", sub: "Your company just grew into a new era. If Silicon has earned it, a quick rating helps other founders discover it. It only takes a second." },
};

export function ReviewPrompt() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [queued, setQueued] = useState<ReviewMoment | null>(null);
  // Yield the stage to the player's own launch payoff if it's somehow still playing (the trigger is
  // already delayed past it) — the review ask should never step on the keynote.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  useEffect(() => onReviewPrompt((moment) => setQueued(moment)), []);
  const showing = queued !== null && !revealUp;

  useHoldSim(showing);
  useDialogFocus(dialogRef, showing);

  // A gentle, rewarding cue once when it appears.
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("confirm");
    haptic.success();
  }, [showing]);

  useEscapeLayer(showing, () => { setQueued(null); });

  if (!showing || queued === null) return null;
  const copy = COPY[queued];

  const rate = () => {
    haptic.medium();
    markReviewRated(); // they've been handed to StoreKit: never ask again
    void requestAppStoreReview(); // native StoreKit prompt (no-op on web)
    setQueued(null);
  };
  const later = () => { haptic.light(); setQueued(null); };

  return (
    <div className="rev">
      <button className="rev__scrim" aria-label="Maybe later" onClick={later} />
      <div ref={dialogRef} tabIndex={-1} className="rev__card" role="dialog" aria-modal="true" aria-label="Enjoying Silicon? Leave a review">
        <div className="rev__stars" aria-hidden>
          {STARS.map((i) => (
            <span key={i} className="rev__star" style={{ animationDelay: `${120 + i * 80}ms` }}>
              <Star size={30} strokeWidth={1.5} fill="currentColor" />
            </span>
          ))}
        </div>
        <div className="rev__eyebrow">{copy.eyebrow}</div>
        <h2 className="rev__title">Enjoying Silicon?</h2>
        <p className="rev__sub">{copy.sub}</p>
        <div className="rev__actions">
          <Button block onClick={rate}><Star size={16} fill="currentColor" /> Rate on the App Store</Button>
          <button className="rev__later" onClick={later}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}
