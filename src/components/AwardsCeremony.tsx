// The Silicon Awards ceremony — the industry's annual moment, every 52 weeks. Full-screen card
// listing the year's winners across player AND rival launches; categories the player won glow
// gold and pay out (+rep/+fans) on Continue. Losing on stage to a named rival product is the
// point: it builds a nemesis. Mounted once in App; same pause/overlay contract as ReadyToLaunch.
import { useEffect, useRef, useState } from "react";
import { Award, Trophy } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { AWARD_FANS_BONUS, AWARD_REP_BONUS } from "../state/gameState.ts";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./awardsCeremony.css";

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

  // Pause for the moment; restore the prior run state when the stage clears.
  const pausedByUs = useRef(false);
  const wasPaused = useRef(false);
  useEffect(() => {
    if (showing) {
      if (!pausedByUs.current) {
        wasPaused.current = paused;
        pausedByUs.current = true;
        setPaused(true);
        sfx("era");
        haptic.success();
      }
    } else if (pausedByUs.current) {
      pausedByUs.current = false;
      setPaused(wasPaused.current);
    }
  }, [showing, paused, setPaused]);
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

  return (
    <div className="awd">
      <div className="awd__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="awd__card" role="dialog" aria-modal="true" aria-label={`The Silicon Awards, year ${ceremony.year}`}>
        <div className="awd__eyebrow"><Award size={13} aria-hidden /> The Silicon Awards · Year {ceremony.year}</div>
        <h2 className="awd__title">
          {ceremony.playerWins > 0
            ? ceremony.playerWins === ceremony.winners.length
              ? "A clean sweep"
              : `${ceremony.playerWins} ${ceremony.playerWins === 1 ? "award" : "awards"} come home`
            : "The rivals take the stage"}
        </h2>
        <p className="awd__sub">The industry judged every launch of the past year — a field of {ceremony.fieldSize}.</p>

        <div className="awd__list">
          {ceremony.winners.map((w) => (
            <div key={w.categoryId} className={`awd__row${w.byPlayer ? " awd__row--win" : ""}`}>
              <span className="awd__row-glyph" aria-hidden><Trophy size={16} /></span>
              <span className="awd__row-info">
                <span className="awd__row-title">{w.title}</span>
                <span className="awd__row-winner">{w.productName} · {w.byPlayer ? "YOU" : w.companyName}</span>
              </span>
              <span className="awd__row-score tnum">{w.score}</span>
            </div>
          ))}
        </div>

        {ceremony.playerWins > 0 && (
          <p className="awd__payout">+{AWARD_REP_BONUS * ceremony.playerWins} reputation · +{(AWARD_FANS_BONUS * ceremony.playerWins).toLocaleString()} fans</p>
        )}

        <Button block haptics="none" onClick={collectAwards}>
          {ceremony.playerWins > 0 ? "Collect the trophies" : "Next year, then"}
        </Button>
      </div>
    </div>
  );
}
