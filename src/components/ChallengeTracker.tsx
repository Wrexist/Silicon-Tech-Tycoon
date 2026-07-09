// In-run challenge tracker — shown on HQ while a daily/weekly challenge run is active. Surfaces the
// scored goal, live score, weeks remaining, and the locked final score + personal best on completion.
import { useState } from "react";
import { CalendarDays, CalendarRange, Trophy, Share2, Home } from "lucide-react";
import { Button, Card, Sheet } from "../design/primitives.tsx";
import { ResultCard } from "./ResultCard.tsx";
import { useGame } from "../state/useGame.tsx";
import { challengeViewFor } from "../state/gameState.ts";
import { formatScore, scoreMetricLabel } from "../engine/challenges.ts";
import { bestScore, challengeKey } from "../state/challengeProgress.ts";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import "../screens/scenarios.css";

export function ChallengeTracker() {
  const { state, homeSaved, returnHome } = useGame();
  const [cardOpen, setCardOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leave = () => {
    if (returnHome()) { haptic.success(); showToast("Back to your company — your challenge best is saved.", { tone: "positive" }); }
  };
  if (!state.activeChallenge) return null;
  const view = challengeViewFor(state);
  if (!view) return null;
  const { challenge, current, final, weeksLeft } = view;
  const isWeekly = challenge.kind === "weekly";
  const best = bestScore(challengeKey(challenge.kind, challenge.dateKey));
  const metric = challenge.scoreMetric;
  const done = final != null;

  return (
    <Card className="scn-track">
      <div className="scn-track__top">
        <span className="scn-track__name">
          {isWeekly ? <CalendarRange size={15} /> : <CalendarDays size={15} />} {isWeekly ? "Weekly" : "Daily"} Challenge
        </span>
        {best != null && (
          <span className="scn__best tnum"><Trophy size={13} /> {formatScore(metric, best)}</span>
        )}
      </div>

      <span className="scn-track__label">Goal: highest {scoreMetricLabel(metric)} by week {challenge.scoreWeek}</span>

      <div className="scn-track__obj-row">
        <span className="scn-track__obj-label">{done ? "Final score" : "Current"}</span>
        <span className="scn-track__obj-val tnum">{formatScore(metric, done ? final : current)}</span>
      </div>

      {done ? (
        <div className="scn-track__banner scn-track__banner--win">
          Challenge complete, scored {formatScore(metric, final)}{best != null && final >= best ? " (your best!)" : ""}.
        </div>
      ) : (
        <div className="scn-track__obj-row">
          <span className="scn-track__obj-label">Weeks left</span>
          <span className="scn-track__obj-val tnum">{weeksLeft}</span>
        </div>
      )}

      {done && (
        <Button size="sm" variant="secondary" onClick={() => setCardOpen(true)}>
          <Share2 size={15} /> View result card
        </Button>
      )}

      {/* Your real company was stashed when this challenge began — leave any time to go back to it. */}
      {homeSaved && (
        confirmLeave ? (
          <div className="scn-track__leave">
            <span className="scn-track__leave-q">Leave this challenge and return to your company? Your best score is kept.</span>
            <div className="scn-track__leave-row">
              <Button size="sm" variant="secondary" onClick={leave}><Home size={15} /> Return home</Button>
              <Button size="sm" variant="tertiary" onClick={() => setConfirmLeave(false)}>Keep playing</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="tertiary" onClick={() => setConfirmLeave(true)}>
            <Home size={15} /> Return to your company
          </Button>
        )
      )}

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} label="Daily challenge">
        <ResultCard state={state} result={null} />
      </Sheet>
    </Card>
  );
}
