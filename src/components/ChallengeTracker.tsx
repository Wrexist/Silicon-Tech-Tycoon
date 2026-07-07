// In-run challenge tracker — shown on HQ while a daily/weekly challenge run is active. Surfaces the
// scored goal, live score, weeks remaining, and the locked final score + personal best on completion.
import { useState } from "react";
import { CalendarDays, CalendarRange, Trophy, Share2 } from "lucide-react";
import { Button, Card, Sheet } from "../design/primitives.tsx";
import { ResultCard } from "./ResultCard.tsx";
import { useGame } from "../state/useGame.tsx";
import { challengeViewFor } from "../state/gameState.ts";
import { formatScore, scoreMetricLabel } from "../engine/challenges.ts";
import { bestScore, challengeKey } from "../state/challengeProgress.ts";
import "../screens/scenarios.css";

export function ChallengeTracker() {
  const { state } = useGame();
  const [cardOpen, setCardOpen] = useState(false);
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

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} label="Daily challenge">
        <ResultCard state={state} result={null} />
      </Sheet>
    </Card>
  );
}
