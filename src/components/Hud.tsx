import { Calendar, FastForward, FlaskConical, Pause, Play, Settings as SettingsIcon, SkipForward, Star, Trophy } from "lucide-react";
import { AnimatedInt, AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { format } from "../engine/money.ts";
import { eraName } from "../engine/eras.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { weeklyOutflow, nextWeekRevenue } from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import "./hud.css";

function weekLabel(week: number): string {
  const year = Math.floor(week / 52) + 1;
  const quarter = Math.floor((week % 52) / 13) + 1;
  return `Y${year} Q${quarter}`;
}

export function Hud({ onSettings, onOpenBank, onOpenProgress }: { onSettings: () => void; onOpenBank: () => void; onOpenProgress?: () => void }) {
  const { state, paused, setPaused, fast, setFast } = useGame();
  // Critical-runway signal: the HQ/Company runway pills live below the fold, so when cash will
  // run out within a month the always-visible headline number itself turns negative. Same math
  // as the HQ pill (burn vs next week's revenue); sandbox's cash floor never gets here.
  const runway = runwayWeeks(state.cash, weeklyOutflow(state), nextWeekRevenue(state));
  const critical = runway < 4;
  return (
    <header className="hud">
      {/* Left column: brand badge over the cash readout (taps to the Bank). */}
      <div className="hud__brand">
        <button
          type="button"
          className="hud__cash"
          onClick={onOpenBank}
          aria-label={`Open Bank. Cash ${format(state.cash)}${critical ? `, ${runway} weeks of runway left` : ""}`}
        >
          <span className="hud__cash-text">
            <span className={`hud__cash-label${critical ? " hud__cash-label--danger" : ""}`} aria-hidden>
              {critical ? `Cash · ${runway} wk left` : "Cash"}
            </span>
            <AnimatedMoney value={state.cash} className={`hud__cash-value rounded${critical ? " hud__cash-value--danger" : ""}`} />
          </span>
        </button>
      </div>
      <div className="hud__meta">
        {/* Chips and buttons wrap as GROUPS — on narrow phones the buttons drop to their own
            right-aligned row instead of splitting at an arbitrary chip boundary. */}
        <div className="hud__chips">
          <div
            className="hud__chip hud__chip--rp"
            title="Research Points"
            aria-label={`Research points: ${Math.floor(state.researchPoints)}`}
          >
            <FlaskConical size={13} strokeWidth={2.2} aria-hidden />
            <span className="hud__chip-tag" aria-hidden>RP</span>
            <span aria-hidden>
              <AnimatedInt value={Math.floor(state.researchPoints)} />
            </span>
          </div>
          <div
            className="hud__chip"
            title="Reputation"
            aria-label={`Reputation ${Math.round(state.reputation)} of 100`}
          >
            <Star size={13} strokeWidth={2.4} fill="currentColor" style={{ color: "var(--warning)" }} aria-hidden />
            <span className="hud__chip-tag" aria-hidden>Rep</span>
            <span className="tnum" aria-hidden>{Math.round(state.reputation)}</span>
          </div>
          <div
            className="hud__chip hud__chip--muted"
            title={`${eraName(state.era)} · ${weekLabel(state.week)}`}
            aria-label={`Week ${state.week}`}
          >
            <Calendar size={13} strokeWidth={2.2} aria-hidden />
            <span className="tnum" aria-hidden>Wk {state.week}</span>
            <span className="hud__chip-sep" aria-hidden>·</span>
            <span className="tnum" aria-hidden>{weekLabel(state.week)}</span>
          </div>
        </div>
        <div className="hud__controls">
          {/* Time controls live up here only DURING the first-build tutorial (the Coach points at
              "the top bar", and the bottom band is free of the Design wizard footer). Once the
              player has finished the tutorial they move to the thumb-reachable floating SpeedDial. */}
          {!state.tutorialDone && (
            <>
              <button
                className="hud__pause"
                onClick={() => setPaused(!paused)}
                aria-label={paused ? "Resume" : "Pause"}
                aria-pressed={paused}
              >
                {paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              </button>
              <button
                className={`hud__pause${fast && !paused ? " hud__pause--on" : ""}`}
                onClick={() => { setFast(!fast); if (!fast) setPaused(false); }}
                aria-label={fast ? "Normal speed" : "Fast forward"}
                aria-pressed={fast}
              >
                <FastForward size={14} fill="currentColor" />
              </button>
            </>
          )}
          {onOpenProgress && (
            <button className="hud__pause" onClick={onOpenProgress} aria-label="Progress, achievements and challenges">
              <Trophy size={15} />
            </button>
          )}
          <button className="hud__pause" onClick={onSettings} aria-label="Settings">
            <SettingsIcon size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

/** Thumb-reachable floating simulation-speed control (Pause/Resume + Fast-forward). Rendered after
 *  the tutorial, when the time controls leave the top HUD; hidden on the Design tab where the build
 *  wizard owns the bottom band. Sits just above the tab bar at the bottom-right (App gates it). */
export function SpeedDial() {
  const { paused, setPaused, fast, setFast, skipping, setSkipping } = useGame();
  return (
    <div className="speeddial" role="group" aria-label="Simulation speed">
      <button
        className="speeddial__btn"
        onClick={() => { if (!paused) setSkipping(false); setPaused(!paused); }}
        aria-label={paused ? "Resume" : "Pause"}
        aria-pressed={paused}
      >
        {paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
      </button>
      <button
        className={`speeddial__btn${fast && !paused ? " speeddial__btn--on" : ""}`}
        onClick={() => { setFast(!fast); if (!fast) { setPaused(false); setSkipping(false); } }}
        aria-label={fast ? "Normal speed" : "Fast forward"}
        aria-pressed={fast}
      >
        <FastForward size={18} fill="currentColor" />
      </button>
      {/* Skip to next decision — run fast until the sim produces something that needs input
          (build ready, event, era goal, finished run, low cash), then auto-pause with the
          reason. Time becomes decision-paced instead of clock-watching. */}
      <button
        className={`speeddial__btn${skipping && !paused ? " speeddial__btn--on" : ""}`}
        onClick={() => { setSkipping(!skipping); if (!skipping) { setPaused(false); setFast(false); } }}
        aria-label={skipping ? "Stop skipping" : "Skip to next event"}
        aria-pressed={skipping}
      >
        <SkipForward size={18} fill="currentColor" />
      </button>
    </div>
  );
}
