// Scenarios picker — hand-crafted challenges with tiered star goals (the retention backbone).
// Premium card list mirroring the Achievements sheet's visual language: difficulty chip, the three
// star tiers with their objectives, and the player's best stars per scenario (profile-level).
// Starting a scenario parks the player's freeform company (stashed, restorable from the scenario
// tracker's "return to your company"), so it asks for confirmation first but never destroys it.
import { useState } from "react";
import { Star, Target, Clock } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { SCENARIOS, type Scenario } from "../engine/scenarios.ts";
import { getScenarioStars } from "../state/scenarioProgress.ts";
import { netWorth } from "../state/gameState.ts";
import { format } from "../engine/money.ts";
import { useGame } from "../state/useGame.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
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
    const sc = SCENARIOS.find((x) => x.id === id);
    startScenario(id);
    // Resetting the whole world deserves an acknowledging beat, plus the first goal to chase.
    haptic.success();
    sfx("confirm");
    const first = sc?.tiers[0]?.objectives[0]?.label;
    showToast(`${sc?.name ?? "Scenario"} started${first ? ` — first goal: ${first}` : ""}`, { tone: "positive", glyph: <Target size={15} /> });
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
        <div className="scn__confirm" role="dialog" aria-modal="true" aria-label="Confirm starting scenario"
          onClick={() => setConfirmId(null)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setConfirmId(null); } }}>
          <div className="scn__confirm-card" onClick={(e) => e.stopPropagation()}>
            <p className="scn__confirm-title">Start “{confirmScenario.name}”?</p>
            {state.activeChallenge || state.activeScenario ? (
              <p className="scn__confirm-text">
                This starts a fresh scenario run in place of the current one. Your parked company is untouched — you'll still
                return to it. Scenario stars and your museum are kept.
              </p>
            ) : (
              <p className="scn__confirm-text">
                <strong>{state.companyName}</strong> (Wk {state.week} · {format(netWorth(state))} net worth) is kept safe — return
                to it any time from the scenario tracker. Scenario stars and your museum are kept.
              </p>
            )}
            <div className="scn__confirm-row">
              <Button variant="secondary" autoFocus onClick={() => setConfirmId(null)}>Cancel</Button>
              <Button haptics="none" onClick={() => begin(confirmScenario.id)}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
