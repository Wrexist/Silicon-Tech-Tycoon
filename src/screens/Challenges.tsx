// Daily / weekly challenges picker — today's seeded challenges + your personal best, one attempt.
// Reuses the scenarios card visual language (scenarios.css). Starting a challenge replaces the
// current company, so it confirms first.
import { useState } from "react";
import { CalendarDays, CalendarRange, Target, Trophy } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import {
  dailyChallenge,
  weeklyChallenge,
  dateKeyOf,
  formatScore,
  scoreMetricLabel,
  type Challenge,
  type ChallengeKind,
} from "../engine/challenges.ts";
import { bestScore, challengeKey, challengeHistory } from "../state/challengeProgress.ts";
import { useGame } from "../state/useGame.tsx";
import "./scenarios.css";

function ChallengeCard({ challenge, onPlay }: { challenge: Challenge; onPlay: () => void }) {
  const isWeekly = challenge.kind === "weekly";
  const best = bestScore(challengeKey(challenge.kind, challenge.dateKey));
  return (
    <li className="scn__card scn__card--played">
      <div className="scn__card-top">
        <span className={`scn__diff ${isWeekly ? "scn__diff--expert" : "scn__diff--standard"}`}>
          {isWeekly ? <CalendarRange size={12} /> : <CalendarDays size={12} />} {isWeekly ? "Weekly" : "Daily"}
        </span>
        {best != null && (
          <span className="scn__best tnum"><Trophy size={13} /> {formatScore(challenge.scoreMetric, best)}</span>
        )}
      </div>
      <h3 className="scn__name">{isWeekly ? "Weekly Challenge" : "Daily Challenge"}</h3>
      <p className="scn__tagline">Highest {scoreMetricLabel(challenge.scoreMetric)} by week {challenge.scoreWeek}</p>

      <ul className="scn__tiers">
        {challenge.mutators.map((m) => (
          <li key={m.id} className="scn__tier scn__tier--met">
            <Target size={12} />
            <span className="scn__tier-objs"><strong>{m.name}</strong> — {m.description}</span>
          </li>
        ))}
      </ul>

      <Button block size="sm" onClick={onPlay}>
        <Target size={15} /> {best != null ? "Beat your best" : "Play challenge"}
      </Button>
    </li>
  );
}

export function ChallengesSheet({ onClose }: { onClose: () => void }) {
  const { startChallenge } = useGame();
  const [confirmKind, setConfirmKind] = useState<ChallengeKind | null>(null);
  const today = dateKeyOf(new Date());
  const daily = dailyChallenge(today);
  const weekly = weeklyChallenge(today);

  const begin = (kind: ChallengeKind) => {
    startChallenge(kind);
    onClose();
  };

  const history = challengeHistory();

  return (
    <div className="scn">
      <div className="scn__head">
        <div>
          <h2 className="scn__title">Challenges</h2>
          <p className="scn__sub">A fresh, seeded challenge every day. One run — beat your own best.</p>
        </div>
      </div>

      <ul className="scn__list">
        <ChallengeCard challenge={daily} onPlay={() => setConfirmKind("daily")} />
        <ChallengeCard challenge={weekly} onPlay={() => setConfirmKind("weekly")} />
      </ul>

      {history.length > 0 && (
        <>
          <p className="scn__hist-head">Your history <span className="tnum">· {history.length}</span></p>
          <ul className="scn__hist">
            {history.slice(0, 30).map((h) => {
              const ch = h.kind === "weekly" ? weeklyChallenge(h.dateKey) : dailyChallenge(h.dateKey);
              return (
                <li key={`${h.kind}:${h.dateKey}`} className="scn__hist-row">
                  <span className="scn__hist-kind">{h.kind === "weekly" ? <CalendarRange size={13} /> : <CalendarDays size={13} />}</span>
                  <span className="scn__hist-date">{h.dateKey}</span>
                  <span className="scn__hist-goal">{scoreMetricLabel(ch.scoreMetric)}</span>
                  <span className="scn__hist-score tnum">{formatScore(ch.scoreMetric, h.score)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button block variant="secondary" onClick={onClose}>Done</Button>

      {confirmKind && (
        <div className="scn__confirm" role="dialog" aria-modal="true" aria-label="Confirm starting challenge">
          <div className="scn__confirm-card">
            <p className="scn__confirm-title">Start the {confirmKind} challenge?</p>
            <p className="scn__confirm-text">This replaces your current company. Your best score is kept.</p>
            <div className="scn__confirm-row">
              <Button variant="secondary" onClick={() => setConfirmKind(null)}>Cancel</Button>
              <Button onClick={() => begin(confirmKind)}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
