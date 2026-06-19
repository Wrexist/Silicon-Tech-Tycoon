// Scenarios picker — hand-crafted challenges with tiered star goals (the retention backbone).
// Premium card list mirroring the Achievements sheet's visual language: difficulty chip, the three
// star tiers with their objectives, and the player's best stars per scenario (profile-level).
// Starting a scenario replaces the current company, so it asks for confirmation first.
import { useState } from "react";
import { Star, Target, Clock } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { SCENARIOS, type Scenario } from "../engine/scenarios.ts";
import { getScenarioStars } from "../state/scenarioProgress.ts";
import { useGame } from "../state/useGame.tsx";
import "./scenarios.css";

const DIFFICULTY_LABEL: Record<Scenario["difficulty"], string> = {
  intro: "Intro",
  standard: "Standard",
  hard: "Hard",
  expert: "Expert",
};

/** Three stars, filled up to `n` (gold), the rest outlined. */
function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="scn__stars" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= n ? "scn__star scn__star--on" : "scn__star"}
          fill={i <= n ? "currentColor" : "none"}
          strokeWidth={1.8}
        />
      ))}
    </span>
  );
}

export function ScenariosSheet({ onClose }: { onClose: () => void }) {
  const { state, startScenario } = useGame();
  const best = getScenarioStars();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const totalStars = SCENARIOS.reduce((sum, s) => sum + (best[s.id] ?? 0), 0);
  const maxStars = SCENARIOS.length * 3;
  const confirmScenario = confirmId ? SCENARIOS.find((s) => s.id === confirmId) : null;

  const begin = (id: string) => {
    startScenario(id);
    onClose();
  };

  return (
    <div className="scn">
      <div className="scn__head">
        <div>
          <h2 className="scn__title">Scenarios</h2>
          <p className="scn__sub">Hand-crafted challenges with star goals. Earn all three for mastery.</p>
        </div>
        <span className="scn__count tnum" aria-label={`${totalStars} of ${maxStars} stars earned`}>
          {totalStars}<span className="scn__count-total">/{maxStars}★</span>
        </span>
      </div>

      <ul className="scn__list">
        {SCENARIOS.map((s) => {
          const earned = best[s.id] ?? 0;
          const isActive = state.activeScenario === s.id;
          return (
            <li key={s.id} className={`scn__card${earned > 0 ? " scn__card--played" : ""}`}>
              <div className="scn__card-top">
                <span className={`scn__diff scn__diff--${s.difficulty}`}>{DIFFICULTY_LABEL[s.difficulty]}</span>
                <Stars n={earned} />
              </div>
              <h3 className="scn__name">{s.name}</h3>
              <p className="scn__tagline">{s.tagline}</p>
              <p className="scn__desc">{s.description}</p>

              <ul className="scn__tiers">
                {s.tiers.map((t) => (
                  <li key={t.stars} className={`scn__tier${earned >= t.stars ? " scn__tier--met" : ""}`}>
                    <Stars n={t.stars} size={12} />
                    <span className="scn__tier-objs">
                      {t.objectives.map((o) => o.label).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>

              {s.deadlineWeek != null && (
                <p className="scn__deadline"><Clock size={12} /> Time limit: week {s.deadlineWeek}</p>
              )}

              <Button
                block
                size="sm"
                variant={isActive ? "secondary" : "primary"}
                onClick={() => setConfirmId(s.id)}
              >
                <Target size={15} /> {isActive ? "Restart this scenario" : earned > 0 ? "Play again" : "Play scenario"}
              </Button>
            </li>
          );
        })}
      </ul>

      <Button block variant="secondary" onClick={onClose}>Done</Button>

      {confirmScenario && (
        <div className="scn__confirm" role="dialog" aria-modal="true" aria-label="Confirm starting scenario">
          <div className="scn__confirm-card">
            <p className="scn__confirm-title">Start “{confirmScenario.name}”?</p>
            <p className="scn__confirm-text">This replaces your current company. Scenario progress (stars) is kept.</p>
            <div className="scn__confirm-row">
              <Button variant="secondary" onClick={() => setConfirmId(null)}>Cancel</Button>
              <Button onClick={() => begin(confirmScenario.id)}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
