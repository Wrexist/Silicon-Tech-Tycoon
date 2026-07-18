// "Today in Silicon" — surfaces the daily challenge (the designed daily hook) on the screen every
// session starts on, instead of leaving it three taps deep behind the HUD trophy. Shown post-first-
// ship (the same meta-layer gate as the Progress hub) and only when no challenge run is active (the
// ChallengeTracker owns HQ during one). Play routes through the Challenges sheet, which owns the
// confirm-before-overwrite flow — this card never starts a run directly.
import { CalendarDays, ChevronRight, Trophy, Zap, Sparkles } from "lucide-react";
import { Card } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { dailyChallenge, dateKeyOf, scoreMetricLabel, formatScore } from "../engine/challenges.ts";
import { bestScore, challengeKey } from "../state/challengeProgress.ts";
import { currentSeasonId, seasonLabel, seasonRewards, seasonCount } from "../state/seasons.ts";
import { useGame } from "../state/useGame.tsx";
import "./dailyChallengeCard.css";

export function DailyChallengeCard({ onOpen }: { onOpen: () => void }) {
  const { state } = useGame();
  const hasShipped = state.launched.length >= 1 || state.legacy > 0;
  if (!hasShipped || state.activeChallenge) return null;

  const today = dailyChallenge(dateKeyOf(new Date()));
  const best = bestScore(challengeKey(today.kind, today.dateKey));

  // Compact Challenge-Season hint: this month's next cosmetic reward + progress toward it.
  const seasonId = currentSeasonId();
  const sCount = seasonCount(seasonId);
  const nextReward = seasonRewards(seasonId).find((r) => sCount < r.rung);

  return (
    <Card className="dailyc">
      <button className="dailyc__body" onClick={() => { haptic.light(); onOpen(); }}>
        <span className="dailyc__glyph" aria-hidden><CalendarDays size={18} /></span>
        <span className="dailyc__info">
          <span className="dailyc__title">Today's challenge</span>
          <span className="dailyc__goal">
            Highest {scoreMetricLabel(today.scoreMetric)} by week {today.scoreWeek}
          </span>
          <span className="dailyc__twist">
            <Zap size={11} aria-hidden /> {today.mutators.map((m) => m.name).join(" · ")}
          </span>
        </span>
        <span className="dailyc__side">
          {best != null && (
            <span className="dailyc__best tnum">
              <Trophy size={12} aria-hidden /> {formatScore(today.scoreMetric, best)}
            </span>
          )}
          <ChevronRight size={16} className="dailyc__caret" aria-hidden />
        </span>
      </button>
      <span className="dailyc__season">
        <Sparkles size={11} aria-hidden />
        <span className="dailyc__season-label">{seasonLabel(seasonId)}</span>
        <span className="dailyc__season-next">
          {nextReward
            ? <>Next: {nextReward.name} <span className="tnum">· {sCount}/{nextReward.rung}</span></>
            : "All season rewards earned"}
        </span>
      </span>
    </Card>
  );
}
