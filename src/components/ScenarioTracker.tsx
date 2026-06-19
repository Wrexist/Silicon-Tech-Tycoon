// In-run scenario objective tracker — shown on HQ while a scenario run is active. Surfaces the
// immediate goal (the next unmet star tier) with live progress, the stars earned so far, and a
// closure banner on full mastery (3★) or a failed deadline. Reads the pure selector; no new state.
import { useState } from "react";
import { Star, Share2 } from "lucide-react";
import { Button, Card, Sheet } from "../design/primitives.tsx";
import { ResultCard } from "./ResultCard.tsx";
import { useGame } from "../state/useGame.tsx";
import { scenarioResultFor } from "../state/gameState.ts";
import { scenarioById, canEarnStars, type ScenarioMetric, type ScenarioTier } from "../engine/scenarios.ts";
import { bestStars } from "../state/scenarioProgress.ts";
import { eraName } from "../engine/eras.ts";
import { dollars, format } from "../engine/money.ts";
import "../screens/scenarios.css";

function fmtMetric(metric: ScenarioMetric, value: number): string {
  switch (metric) {
    case "cumulativeRevenue":
    case "netWorth":
      return format(dollars(Math.round(value)));
    case "fans":
      return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(Math.round(value));
    case "era":
      return eraName(Math.round(value));
    default:
      return String(Math.round(value));
  }
}

function Stars({ n }: { n: number }) {
  return (
    <span className="scn__stars" aria-label={`${n} of 3 stars earned`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={14} className={i <= n ? "scn__star scn__star--on" : "scn__star"}
          fill={i <= n ? "currentColor" : "none"} strokeWidth={1.8} />
      ))}
    </span>
  );
}

export function ScenarioTracker() {
  const { state } = useGame();
  const [cardOpen, setCardOpen] = useState(false);
  if (!state.activeScenario) return null;
  const scn = scenarioById(state.activeScenario);
  const res = scenarioResultFor(state);
  if (!scn || !res) return null;

  // Once past the deadline the run is settled: show the EARNED (recorded, deadline-honest) result,
  // not late live progress — stars stop being earnable after the deadline (see announceScenarioStars).
  const pastDeadline = !canEarnStars(scn, state.week);
  const earned = bestStars(state.activeScenario);
  const stars = pastDeadline ? earned : res.stars;
  const lost = pastDeadline && earned === 0;

  // The tier the player is working toward now (stars 0→1★, 1→2★, 2→3★; 3 = mastered).
  const nextTier: ScenarioTier | null = !pastDeadline && stars < 3 ? scn.tiers[stars as 0 | 1 | 2] : null;
  const tierObjectives = nextTier
    ? res.objectives.filter((o) => o.tier === nextTier.stars)
    : [];

  return (
    <Card className="scn-track">
      <div className="scn-track__top">
        <span className="scn-track__name">{scn.name}</span>
        <Stars n={stars} />
      </div>

      {stars === 3 && (
        <div className="scn-track__banner scn-track__banner--win">Scenario mastered — all three stars earned.</div>
      )}

      {lost && (
        <div className="scn-track__banner scn-track__banner--fail">
          Deadline passed (week {scn.deadlineWeek}). The 1★ goal wasn’t met — restart from Scenarios to try again.
        </div>
      )}

      {/* Show the live goal whenever the run is ongoing and not mastered. */}
      {!lost && nextTier && (
        <>
          <span className="scn-track__label">Next: {nextTier.stars}★ goal</span>
          <ul className="scn-track__objs">
            {tierObjectives.map((o, i) => {
              const frac = o.objective.target > 0 ? Math.max(0, Math.min(1, o.current / o.objective.target)) : (o.met ? 1 : 0);
              return (
                <li key={i} className={`scn-track__obj${o.met ? " scn-track__obj--met" : ""}`}>
                  <div className="scn-track__obj-row">
                    <span className="scn-track__obj-label">{o.objective.label}</span>
                    <span className="scn-track__obj-val tnum">
                      {fmtMetric(o.objective.metric, o.current)} / {fmtMetric(o.objective.metric, o.objective.target)}
                    </span>
                  </div>
                  <div className="scn-track__bar"><div className="scn-track__bar-fill" style={{ width: `${frac * 100}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Once the player has earned any star, let them open the shareable result card. */}
      {stars > 0 && (
        <Button size="sm" variant="secondary" onClick={() => setCardOpen(true)}>
          <Share2 size={15} /> View result card
        </Button>
      )}

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)}>
        <ResultCard state={state} result={res} />
      </Sheet>
    </Card>
  );
}
