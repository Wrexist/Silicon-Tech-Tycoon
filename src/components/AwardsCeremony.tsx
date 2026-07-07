// The Silicon Awards ceremony — the industry's annual moment, every 52 weeks. Full-screen card
// listing the year's winners across player AND rival launches; categories the player won glow
// gold, count up on stage, and pay out (+rep/+fans) on Continue. Losing on stage to a named rival
// product is the point: it builds a nemesis. Mounted once in App; same pause/overlay contract as
// ReadyToLaunch, plus a confetti burst + staggered reveal when a trophy comes home.
import { useEffect, useRef, useState } from "react";
import { Award, Gem, Palette, Trophy, type LucideIcon } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { AWARD_FANS_BONUS, AWARD_REP_BONUS } from "../state/gameState.ts";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { AnimatedInt } from "../design/AnimatedNumber.tsx";
import type { AwardCategoryId } from "../engine/awards.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./awardsCeremony.css";

// A distinct medal per category so the three trophies read apart at a glance.
const CATEGORY_ICON: Record<AwardCategoryId, LucideIcon> = {
  device: Trophy,
  design: Palette,
  value: Gem,
};

export function AwardsCeremonyOverlay() {
  const { state, paused, setPaused, collectAwards } = useGame();
  const ceremony = state.pendingAwards ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);
  // Serialize interrupts: the ceremony yields to the launch reveal (bus-driven, z60), a pending
  // rival strike, and any unclaimed ready build, so only one modal owns the screen (pause + Escape)
  // at a time. State holds pendingAwards until those clear, then the ceremony takes the stage.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || state.pendingStrike != null || state.ready.some((p) => !readyLaunchClaimed(p.id));
  const showing = ceremony !== null && !higherUp;

  // The scores mount at 0 and count up once the card is on stage (see AnimatedInt). `revealed`
  // flips a frame after show so the tween has a from→to to animate.
  const [revealed, setRevealed] = useState(false);

  // Pause for the moment; restore the prior run state when the stage clears.
  const pausedByUs = useRef(false);
  const wasPaused = useRef(false);
  useEffect(() => {
    let raf = 0;
    if (showing) {
      if (!pausedByUs.current) {
        wasPaused.current = paused;
        pausedByUs.current = true;
        setPaused(true);
        sfx("era");
        haptic.success();
        if ((ceremony?.playerWins ?? 0) > 0) emitCelebrate(); // a trophy came home — confetti
        raf = requestAnimationFrame(() => setRevealed(true));
      }
    } else if (pausedByUs.current) {
      pausedByUs.current = false;
      setPaused(wasPaused.current);
      setRevealed(false);
    }
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [showing, paused, setPaused, ceremony]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);

  useDialogFocus(dialogRef, showing);
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") collectAwards(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showing, collectAwards]);

  if (!ceremony || !showing) return null;

  const swept = ceremony.playerWins > 0 && ceremony.playerWins === ceremony.winners.length;

  return (
    <div className="awd">
      <div className="awd__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className={`awd__card${swept ? " awd__card--sweep" : ""}`} role="dialog" aria-modal="true" aria-label={`The Silicon Awards, year ${ceremony.year}`}>
        <div className="awd__medallion" aria-hidden><Award size={26} /></div>
        <div className="awd__eyebrow">The Silicon Awards · Year {ceremony.year}</div>
        <h2 className="awd__title">
          {ceremony.playerWins > 0
            ? swept
              ? "A clean sweep"
              : `${ceremony.playerWins} ${ceremony.playerWins === 1 ? "award" : "awards"} come home`
            : "The rivals take the stage"}
        </h2>
        <p className="awd__sub">The industry judged every launch of the past year — a field of {ceremony.fieldSize}.</p>

        <div className="awd__list">
          {ceremony.winners.map((w, i) => {
            const Icon = CATEGORY_ICON[w.categoryId] ?? Trophy;
            return (
              <div
                key={w.categoryId}
                className={`awd__row${w.byPlayer ? " awd__row--win" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                <span className="awd__row-glyph" aria-hidden><Icon size={17} /></span>
                <span className="awd__row-info">
                  <span className="awd__row-title">{w.title}</span>
                  <span className="awd__row-winner">{w.productName} · {w.byPlayer ? "YOU" : w.companyName}</span>
                </span>
                <span className="awd__row-score tnum"><AnimatedInt value={revealed ? w.score : 0} /></span>
              </div>
            );
          })}
        </div>

        {ceremony.playerWins > 0 && (
          <p className="awd__payout">
            <span className="awd__payout-chip">+{AWARD_REP_BONUS * ceremony.playerWins} rep</span>
            <span className="awd__payout-chip">+{(AWARD_FANS_BONUS * ceremony.playerWins).toLocaleString()} fans</span>
          </p>
        )}

        <Button block haptics="none" onClick={collectAwards}>
          {ceremony.playerWins > 0 ? "Collect the trophies" : "Next year, then"}
        </Button>
      </div>
    </div>
  );
}
